import type { PlacedCamera, ScaleCalibration } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'
import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import { buildCableEndpointIndex, cableLabel } from './cable-endpoint-index'
import type { HubBeyondLength } from './cross-floor-hub-beyond-length-resolver'
import type { CableLayout, CableType } from './cable-layout-types'
import {
  computeScaleUncertainty,
  estimateCableLength,
  sumMetersIntervals,
  type CableLengthEstimate,
  type MetersInterval,
  type ScaleUncertainty,
} from './cable-length-estimate-calculator'
import { ceilMeters, formatMeters } from './cable-length-format'

/**
 * The one entry point for cable lengths: panels, the canvas (over-length
 * styling), the BOM and the exports all call `computeCableLayoutEstimate`,
 * so every surface shows the same metres. Without a calibrated scale there
 * are no metres at all - never a `?? 1` fallback.
 */

export interface CableTypeTotal {
  type: CableType
  cableCount: number
  labels: string[]
  run: MetersInterval
  purchase: MetersInterval
  /** Purchase metres rounded up to a whole metre: the BOM quantity. */
  purchaseWholeM: number
  lineTotalVnd: number | null
}

export interface CableEstimateWarning {
  code:
    | 'scale-not-set'
    | 'ref-line-too-short'
    | 'scale-uncertain'
    | 'cable-over-limit'
    | 'cable-maybe-over-limit'
    | 'linked-floor-scale-not-set'
    | 'link-cycle'
    | 'shaft-no-exit'
    | 'shaft-exit-not-chosen'
  message: string
  cableId?: string
}

export interface CableLayoutEstimate {
  hasScale: boolean
  uncertainty: ScaleUncertainty | null
  cables: CableLengthEstimate[]
  byCableId: ReadonlyMap<string, CableLengthEstimate>
  /** In `cableTypes` order; only types with at least one cable. */
  totals: CableTypeTotal[]
  grandPurchase: MetersInterval | null
  /** Sum of the priced types' line totals. */
  grandTotalVnd: number
  unpricedTypeCount: number
  /** Cables that COULD NOT be estimated because their cross-floor route hit a floor with no scale, or a cycle - counted here and warned about, never dropped silently and never shown as 0. Does not include a cable dangling on a deleted device/hub (that is simply absent from `cables`, same as before this phase). */
  unestimatedCableCount: number
  warnings: CableEstimateWarning[]
}

export interface CableLayoutEstimateInput extends CableLayout {
  cameras: readonly PlacedCamera[]
  sensors: readonly PlacedSensor[]
  scale: ScaleCalibration | null
  /** This floor's cross-floor "beyond the hub" contribution per cable (`resolveCableBeyondLengths`). Absent = every cable stays in typed mode - today's behaviour, byte-identical (used by every pre-existing test). */
  beyondByCableId?: ReadonlyMap<string, HubBeyondLength>
  /** The project's `shafts[]` ids, in order - so a shaft marker's label reads "T{n}" (project order), not a per-floor count. Absent on every pre-shaft test/caller - harmless unless this floor actually holds a shaft marker. */
  shaftIds?: readonly string[]
  /** This floor's placed fire-alarm devices - cable ends like cameras and sensors. Absent = no cable can resolve to one (every pre-existing test). */
  fireAlarmDevices?: readonly PlacedFireAlarmDevice[]
  /** Catalog lookup for the fire-alarm designator labels ("S1-H1"); absent = "F{n}". */
  fireAlarmModelById?: FireAlarmKindByModelId
}

export const SCALE_NOT_SET_CABLE_MESSAGE = 'Calibrate the scale to estimate cable lengths.'

/** A defensive fallback only - every floor in a `Project` gets an entry in `computeProjectCableEstimate`'s `byFloorId`, so a lookup by a live `activeFloorId` should never miss. */
export const EMPTY_CABLE_LAYOUT_ESTIMATE: CableLayoutEstimate = {
  hasScale: false,
  uncertainty: null,
  cables: [],
  byCableId: new Map(),
  totals: [],
  grandPurchase: null,
  grandTotalVnd: 0,
  unpricedTypeCount: 0,
  unestimatedCableCount: 0,
  warnings: [],
}

function scaleWarnings(uncertainty: ScaleUncertainty): CableEstimateWarning[] {
  if (uncertainty.minFactor === null) {
    return [{ code: 'ref-line-too-short', message: 'Reference line is shorter than the click error - no min-max range.' }]
  }
  if (!uncertainty.isUnreliable) return []
  const percent = (uncertainty.relativeError * 100).toFixed(1)
  return [{ code: 'scale-uncertain', message: `Reference line too short for a reliable estimate (scale error up to ${percent}%).` }]
}

function limitWarning(cable: CableLengthEstimate, type: CableType): CableEstimateWarning | null {
  if (type.lengthLimitM === null) return null
  const prefix = `${cable.label} (${type.name}):`
  const limit = `${type.lengthLimitM} m limit`
  if (cable.limitStatus === 'over') {
    return { code: 'cable-over-limit', cableId: cable.cableId, message: `${prefix} ${formatMeters(cable.run.nominal)} run exceeds the ${limit}.` }
  }
  if (cable.limitStatus === 'maybe-over') {
    const upTo = formatMeters(cable.run.max ?? cable.run.nominal)
    return { code: 'cable-maybe-over-limit', cableId: cable.cableId, message: `${prefix} may exceed the ${limit} (up to ${upTo}).` }
  }
  return null
}

/** Human text for the "could not estimate" reasons, named by the cable's own label. */
function unavailableWarning(label: string, cableId: string, beyond: Extract<HubBeyondLength, { source: 'unavailable' }>): CableEstimateWarning {
  if (beyond.reason === 'link-cycle') {
    return { code: 'link-cycle', cableId, message: `${label}: its cross-floor route forms a cycle - excluded from the estimate.` }
  }
  if (beyond.reason === 'shaft-exit-not-chosen') {
    return { code: 'shaft-exit-not-chosen', cableId, message: `${label}: no exit chosen for this shaft - excluded from the estimate.` }
  }
  return {
    code: 'linked-floor-scale-not-set',
    cableId,
    message: `${label}: the route continues on "${beyond.floorName}", which has no scale set - excluded from the estimate.`,
  }
}

export function computeCableLayoutEstimate(input: CableLayoutEstimateInput): CableLayoutEstimate {
  const { cables, cableTypes, cableSettings, scale, beyondByCableId } = input
  const empty = {
    cables: [],
    byCableId: new Map(),
    totals: [],
    grandPurchase: null,
    grandTotalVnd: 0,
    unpricedTypeCount: 0,
    unestimatedCableCount: 0,
  }
  if (!scale) {
    const warnings: CableEstimateWarning[] = cables.length > 0 ? [{ code: 'scale-not-set', message: SCALE_NOT_SET_CABLE_MESSAGE }] : []
    return { ...empty, hasScale: false, uncertainty: null, warnings }
  }

  const uncertainty = computeScaleUncertainty(scale, cableSettings.clickErrorPx)
  const index = buildCableEndpointIndex(
    input.cameras,
    input.sensors,
    input.hubs,
    input.shaftIds,
    input.fireAlarmDevices && { devices: input.fireAlarmDevices, modelById: input.fireAlarmModelById },
  )
  const typeById = new Map(cableTypes.map((type): [string, CableType] => [type.id, type]))
  const estimates: CableLengthEstimate[] = []
  const warnings: CableEstimateWarning[] = cables.length > 0 ? scaleWarnings(uncertainty) : []
  let unestimatedCableCount = 0

  for (const cable of cables) {
    const type = typeById.get(cable.typeId)
    if (!type) continue
    const beyond = beyondByCableId?.get(cable.id)
    if (beyond?.source === 'unavailable') {
      unestimatedCableCount += 1
      warnings.push(unavailableWarning(cableLabel(cable, index), cable.id, beyond))
      continue
    }
    const estimate = estimateCableLength({ cable, index, type, settings: cableSettings, planPxPerMeter: scale.planPxPerMeter, uncertainty, beyond })
    if (!estimate) continue
    estimates.push(estimate)
    const warning = limitWarning(estimate, type)
    if (warning) warnings.push(warning)
  }

  const totals: CableTypeTotal[] = []
  for (const type of cableTypes) {
    const ofType = estimates.filter((estimate) => estimate.typeId === type.id)
    if (ofType.length === 0) continue
    const purchase = sumMetersIntervals(ofType.map((estimate) => estimate.purchase))
    const purchaseWholeM = ceilMeters(purchase.nominal)
    totals.push({
      type,
      cableCount: ofType.length,
      labels: ofType.map((estimate) => estimate.label),
      run: sumMetersIntervals(ofType.map((estimate) => estimate.run)),
      purchase,
      purchaseWholeM,
      lineTotalVnd: type.pricePerMeterVnd === null ? null : purchaseWholeM * type.pricePerMeterVnd,
    })
  }

  return {
    hasScale: true,
    uncertainty,
    cables: estimates,
    byCableId: new Map(estimates.map((estimate): [string, CableLengthEstimate] => [estimate.cableId, estimate])),
    totals,
    grandPurchase: totals.length > 0 ? sumMetersIntervals(totals.map((total) => total.purchase)) : null,
    grandTotalVnd: totals.reduce((sum, total) => sum + (total.lineTotalVnd ?? 0), 0),
    unpricedTypeCount: totals.filter((total) => total.lineTotalVnd === null).length,
    unestimatedCableCount,
    warnings,
  }
}
