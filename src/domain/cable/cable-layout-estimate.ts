import type { PlacedCamera, ScaleCalibration } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'
import { buildCableEndpointIndex } from './cable-endpoint-index'
import type { CableLayout, CableType } from './cable-layout-types'
import {
  computeScaleUncertainty,
  estimateCableLength,
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
  code: 'scale-not-set' | 'ref-line-too-short' | 'scale-uncertain' | 'cable-over-limit' | 'cable-maybe-over-limit'
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
  warnings: CableEstimateWarning[]
}

export interface CableLayoutEstimateInput extends CableLayout {
  cameras: readonly PlacedCamera[]
  sensors: readonly PlacedSensor[]
  scale: ScaleCalibration | null
}

export const SCALE_NOT_SET_CABLE_MESSAGE = 'Calibrate the scale to estimate cable lengths.'

/** Sums unrounded values. The interval of a sum is undefined as soon as one part's is. */
export function sumMetersIntervals(intervals: readonly MetersInterval[]): MetersInterval {
  const sum: MetersInterval = { nominal: 0, min: 0, max: 0 }
  for (const interval of intervals) {
    sum.nominal += interval.nominal
    sum.min = sum.min === null || interval.min === null ? null : sum.min + interval.min
    sum.max = sum.max === null || interval.max === null ? null : sum.max + interval.max
  }
  return sum
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

export function computeCableLayoutEstimate(input: CableLayoutEstimateInput): CableLayoutEstimate {
  const { cables, cableTypes, cableSettings, scale } = input
  const empty = { cables: [], byCableId: new Map(), totals: [], grandPurchase: null, grandTotalVnd: 0, unpricedTypeCount: 0 }
  if (!scale) {
    const warnings: CableEstimateWarning[] = cables.length > 0 ? [{ code: 'scale-not-set', message: SCALE_NOT_SET_CABLE_MESSAGE }] : []
    return { ...empty, hasScale: false, uncertainty: null, warnings }
  }

  const uncertainty = computeScaleUncertainty(scale, cableSettings.clickErrorPx)
  const index = buildCableEndpointIndex(input.cameras, input.sensors, input.hubs)
  const typeById = new Map(cableTypes.map((type): [string, CableType] => [type.id, type]))
  const estimates: CableLengthEstimate[] = []
  const warnings: CableEstimateWarning[] = cables.length > 0 ? scaleWarnings(uncertainty) : []

  for (const cable of cables) {
    const type = typeById.get(cable.typeId)
    if (!type) continue
    const estimate = estimateCableLength({ cable, index, type, settings: cableSettings, planPxPerMeter: scale.planPxPerMeter, uncertainty })
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
    warnings,
  }
}
