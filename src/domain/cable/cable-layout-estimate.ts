import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { PlacedCamera, ScaleCalibration } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'
import { formatCableEndToEndLabel } from './cable-end-to-end-label'
import { buildCableEndpointIndex, cableEndRefKey, resolveCableEnd, type CableEndpointIndex } from './cable-endpoint-index'
import { limitWarning, scaleWarnings, shaftNotRoutedWarning, unavailableWarning, type CableEstimateWarning } from './cable-estimate-warnings'
import type { Cable, CableLayout, CableType, Hub } from './cable-layout-types'
import {
  computeScaleUncertainty,
  estimateCableLength,
  sumMetersIntervals,
  type CableLengthEstimate,
  type MetersInterval,
  type ScaleUncertainty,
} from './cable-length-estimate-calculator'
import { ceilMeters } from './cable-length-format'
import type { HubBeyondLength } from './cross-floor-hub-beyond-length-resolver'

export type { CableEstimateWarning } from './cable-estimate-warnings'

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
  /** Catalog lookup for the fire-alarm designator labels; absent = "?{n}". */
  fireAlarmModelById?: FireAlarmKindByModelId
  /**
   * Every cable's end-to-end label (`buildProjectCableEndToEndLabels`), built
   * once by the caller. Absent (every per-floor unit test that calls this
   * function directly) falls back to `fallbackCableLabel` below - a
   * project-less call IS a one-floor project, so the fallback reads exactly
   * like `buildProjectCableEndToEndLabels` would for one floor.
   */
  labelByCableId?: ReadonlyMap<string, string>
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

/**
 * `labelByCableId` fallback for a project-less call: a one-floor label,
 * reached only through `index` (this floor's own device/hub labels) and
 * `hubs` (for the plain-vs-riser/drop/shaft check `CableHubEndpoint` itself
 * cannot make - it carries only `isShaft`). Mirrors
 * `cable-end-to-end-label.ts`'s own "final end reached" rule: a device, or a
 * hub whose own `kind` is a plain hub, counts as reached - a riser / drop /
 * shaft opening does not (unresolved -> bare "?").
 */
function fallbackCableLabel(cable: Cable, index: CableEndpointIndex, hubs: readonly Hub[]): string {
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const start = device ? { floorIndex: 0, label: device.label } : null
  const end = resolveCableEnd(cable, index)
  let finalEnd: { floorIndex: number; label: string } | null = null
  if (end?.kind === 'device') {
    finalEnd = { floorIndex: 0, label: end.device.label }
  } else if (end?.kind === 'hub' && !end.hub.isShaft) {
    const hub = hubs.find((candidate) => candidate.id === end.hub.hubId)
    if ((hub?.kind ?? 'hub') === 'hub') finalEnd = { floorIndex: 0, label: end.hub.label }
  }
  return formatCableEndToEndLabel(start, finalEnd)
}

export function computeCableLayoutEstimate(input: CableLayoutEstimateInput): CableLayoutEstimate {
  const { cables, cableTypes, cableSettings, scale, beyondByCableId, labelByCableId } = input
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
    const label = labelByCableId?.get(cable.id) ?? fallbackCableLabel(cable, index, input.hubs)
    const beyond = beyondByCableId?.get(cable.id)
    if (beyond?.source === 'unavailable') {
      unestimatedCableCount += 1
      warnings.push(unavailableWarning(label, cable.id, beyond))
      continue
    }
    const estimate = estimateCableLength({ cable, index, type, settings: cableSettings, planPxPerMeter: scale.planPxPerMeter, uncertainty, beyond, label })
    if (!estimate) continue
    estimates.push(estimate)
    if (beyond?.source === 'typed' && beyond.shaftNotRouted) warnings.push(shaftNotRoutedWarning(label, cable.id))
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
