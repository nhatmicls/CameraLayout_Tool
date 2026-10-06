import type { ScaleCalibration } from '../project-file/project-types'
import { planPxToMeters } from '../shared/scale-calibration-calculator'
import { cableEndRefKey, cableLabel, resolveCablePathPx, type CableEndpointIndex } from './cable-endpoint-index'
import type { Cable, CablePoint, CableSettings, CableType } from './cable-layout-types'

/**
 * Length estimate of ONE cable, in metres.
 *
 * - Horizontal metres come from the drawn route and the calibrated scale.
 * - Vertical runs (route height vs device / hub height), the length beyond
 *   a riser / drop and end slack are typed in metres, so the scale error
 *   never touches them.
 * - The scale error is one systematic factor shared by every cable: each
 *   calibration click may be `e` px off, so the true reference length in px
 *   lies within `Lref +- 2e`. Measured too short => the real route is
 *   shorter: `min = horizM * Lref/(Lref+2e)`, `max = horizM * Lref/(Lref-2e)`.
 *   Because the factor is shared, per-cable min/max sum exactly to the total
 *   min/max (no root-sum-square).
 */

/** min/max null = the interval is undefined (reference line no longer than the click error). */
export interface MetersInterval {
  nominal: number
  min: number | null
  max: number | null
}

export interface ScaleUncertainty {
  refLengthPx: number
  /** 2e / Lref. */
  relativeError: number
  minFactor: number | null
  maxFactor: number | null
  /** The interval is undefined, or the relative error is above `SCALE_UNRELIABLE_RELATIVE_ERROR`. */
  isUnreliable: boolean
}

export const SCALE_UNRELIABLE_RELATIVE_ERROR = 0.05

export function computeScaleUncertainty(scale: ScaleCalibration, clickErrorPx: number): ScaleUncertainty {
  const { x1, y1, x2, y2 } = scale.refLine
  const refLengthPx = Math.hypot(x2 - x1, y2 - y1)
  const spreadPx = 2 * clickErrorPx
  const relativeError = spreadPx / refLengthPx
  // Lref <= 2e: the true length could be zero, so no upper bound exists.
  if (!(refLengthPx > spreadPx)) {
    return { refLengthPx, relativeError, minFactor: null, maxFactor: null, isUnreliable: true }
  }
  return {
    refLengthPx,
    relativeError,
    minFactor: refLengthPx / (refLengthPx + spreadPx),
    maxFactor: refLengthPx / (refLengthPx - spreadPx),
    isUnreliable: relativeError > SCALE_UNRELIABLE_RELATIVE_ERROR,
  }
}

export type CableLimitStatus = 'ok' | 'maybe-over' | 'over' | 'no-limit'

export interface CableLengthEstimate {
  cableId: string
  typeId: string
  label: string
  horizPx: number
  horizM: number
  deviceRiseM: number
  hubDropM: number
  /** Length on the other floor, beyond a riser / drop; 0 for a plain hub. */
  hubExtraM: number
  slackM: number
  /** Everything typed in metres: rise + drop + beyond + slack. */
  fixedM: number
  /** Installed length: horizontal + fixed, without waste. This is what the length limit checks. */
  run: MetersInterval
  wasteM: number
  /** Run plus the waste allowance: what to buy. */
  purchase: MetersInterval
  limitStatus: CableLimitStatus
}

export function polylineLengthPx(path: readonly CablePoint[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return total
}

export function scaleMetersInterval(interval: MetersInterval, factor: number): MetersInterval {
  return {
    nominal: interval.nominal * factor,
    min: interval.min === null ? null : interval.min * factor,
    max: interval.max === null ? null : interval.max * factor,
  }
}

/** Limit comparison is a strict `>`: a run of exactly the limit is still within it. */
function limitStatusOf(run: MetersInterval, limitM: number | null): CableLimitStatus {
  if (limitM === null) return 'no-limit'
  if (run.nominal > limitM) return 'over'
  return (run.max ?? run.nominal) > limitM ? 'maybe-over' : 'ok'
}

/** null = the cable is dangling (its device or hub no longer exists). `planPxPerMeter` must be the calibrated scale - never a fallback. */
export function estimateCableLength(input: {
  cable: Cable
  index: CableEndpointIndex
  type: CableType
  settings: CableSettings
  planPxPerMeter: number
  uncertainty: ScaleUncertainty
}): CableLengthEstimate | null {
  const { cable, index, type, settings, planPxPerMeter, uncertainty } = input
  const path = resolveCablePathPx(cable, index)
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const hub = index.hubById.get(cable.hubId)
  if (!path || !device || !hub) return null

  const horizPx = polylineLengthPx(path)
  const horizM = planPxToMeters(horizPx, planPxPerMeter)
  const deviceHeightM = device.mountHeightM ?? settings.defaultDeviceHeightM
  const deviceRiseM = Math.abs(settings.routeHeightM - deviceHeightM)
  const hubDropM = Math.abs(settings.routeHeightM - hub.mountHeightM)
  const slackM = settings.deviceEndSlackM + settings.hubEndSlackM
  const hubExtraM = hub.extraLengthM
  const fixedM = deviceRiseM + hubDropM + hubExtraM + slackM

  const { minFactor, maxFactor } = uncertainty
  const run: MetersInterval = {
    nominal: horizM + fixedM,
    min: minFactor === null ? null : horizM * minFactor + fixedM,
    max: maxFactor === null ? null : horizM * maxFactor + fixedM,
  }
  const purchase = scaleMetersInterval(run, 1 + settings.wastePercent / 100)

  return {
    cableId: cable.id,
    typeId: cable.typeId,
    label: cableLabel(cable, index),
    horizPx,
    horizM,
    deviceRiseM,
    hubDropM,
    hubExtraM,
    slackM,
    fixedM,
    run,
    wasteM: purchase.nominal - run.nominal,
    purchase,
    limitStatus: limitStatusOf(run, type.lengthLimitM),
  }
}
