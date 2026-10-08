import { planPxToMeters } from '../shared/scale-calibration-calculator'
import type { ScaleUncertainty } from './cable-scale-uncertainty'
import { cableEndRefKey, cableLabel, resolveCablePathPx, type CableEndpointIndex } from './cable-endpoint-index'
import type { HubBeyondLength } from './cross-floor-hub-beyond-length-resolver'
import type { Cable, CablePoint, CableSettings, CableType } from './cable-layout-types'

export type { ScaleUncertainty } from './cable-scale-uncertainty'
export { computeScaleUncertainty, SCALE_UNRELIABLE_RELATIVE_ERROR } from './cable-scale-uncertainty'

/**
 * Length estimate of ONE cable, in metres.
 *
 * - Horizontal metres come from the drawn route and the calibrated scale.
 * - Vertical runs (route height vs device / hub height), the length beyond
 *   a riser / drop and end slack are typed in metres, so the scale error
 *   never touches them.
 * - The scale error range comes from `cable-scale-uncertainty.ts`
 *   (`computeScaleUncertainty`, re-exported here for every existing
 *   importer): one systematic factor shared by every cable, so per-cable
 *   min/max sum exactly to the total min/max (no root-sum-square).
 */

/** min/max null = the interval is undefined (reference line no longer than the click error). */
export interface MetersInterval {
  nominal: number
  min: number | null
  max: number | null
}

export type CableLimitStatus = 'ok' | 'maybe-over' | 'over' | 'no-limit'

export interface CableLengthEstimate {
  cableId: string
  typeId: string
  label: string
  horizPx: number
  horizM: number
  deviceRiseM: number
  /** Typed mode: `|routeHeightM - hub height|`. Computed (route) mode: just the floor-height crossing - see `hubExtraM`/`beyondVia`. */
  hubDropM: number
  /** Typed mode: the hub's typed "length on the other floor"; 0 for a plain hub. Computed (route) mode: the trunk's own route metres plus whatever is beyond its target hub. */
  hubExtraM: number
  /** Set only in computed (route) mode: where `hubExtraM` leads, e.g. "Floor 2 D1" - the cable panel's breakdown line. */
  beyondVia?: string
  slackM: number
  /** Everything beyond the horizontal route: `deviceRiseM + hubDropM + hubExtraM + slackM` in typed mode, or `deviceRiseM + slackM + beyond.run.nominal` (the floor crossing + trunk route + whatever is past it) in computed mode. */
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

/** Limit comparison is a strict `>`: a run of exactly the limit is still within it. */
function limitStatusOf(run: MetersInterval, limitM: number | null): CableLimitStatus {
  if (limitM === null) return 'no-limit'
  if (run.nominal > limitM) return 'over'
  return (run.max ?? run.nominal) > limitM ? 'maybe-over' : 'ok'
}

/**
 * null = the cable is dangling (its device or hub no longer exists).
 * `planPxPerMeter` must be the calibrated scale - never a fallback.
 *
 * `beyond` is this cable's resolved `HubBeyondLength` (`resolveCableBeyondLengths`).
 * Omitted = typed mode using the hub endpoint's own fields, EXACTLY today's
 * formula (every pre-existing test omits it and stays byte-identical).
 * `source: 'typed'` is the same formula, reached explicitly (an unlinked
 * point, or a linked one whose partner has no trunk yet). `source: 'route'`
 * is the pair's computed mode: `hubDropM` becomes just the floor-height
 * crossing, `hubExtraM` becomes the trunk route + whatever is beyond its
 * target, and `beyondVia` names where that leads. The caller never passes
 * `source: 'unavailable'` here - it is filtered out one layer up
 * (`computeCableLayoutEstimate`), which counts and warns about it instead.
 */
export function estimateCableLength(input: {
  cable: Cable
  index: CableEndpointIndex
  type: CableType
  settings: CableSettings
  planPxPerMeter: number
  uncertainty: ScaleUncertainty
  beyond?: HubBeyondLength
}): CableLengthEstimate | null {
  const { cable, index, type, settings, planPxPerMeter, uncertainty, beyond } = input
  const path = resolveCablePathPx(cable, index)
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const hub = index.hubById.get(cable.hubId)
  if (!path || !device || !hub) return null

  const horizPx = polylineLengthPx(path)
  const horizM = planPxToMeters(horizPx, planPxPerMeter)
  const deviceHeightM = device.mountHeightM ?? settings.defaultDeviceHeightM
  const deviceRiseM = Math.abs(settings.routeHeightM - deviceHeightM)
  const slackM = settings.deviceEndSlackM + settings.hubEndSlackM

  const { minFactor, maxFactor } = uncertainty
  let hubDropM: number
  let hubExtraM: number
  let beyondVia: string | undefined
  let fixedM: number
  let run: MetersInterval

  if (beyond?.source === 'route') {
    hubDropM = beyond.crossingVerticalM
    hubExtraM = beyond.run.nominal - beyond.crossingVerticalM
    beyondVia = beyond.viaLabel
    fixedM = deviceRiseM + slackM + beyond.run.nominal
    run = {
      nominal: horizM + fixedM,
      min: minFactor === null || beyond.run.min === null ? null : horizM * minFactor + deviceRiseM + slackM + beyond.run.min,
      max: maxFactor === null || beyond.run.max === null ? null : horizM * maxFactor + deviceRiseM + slackM + beyond.run.max,
    }
  } else {
    // Undefined or `source: 'typed'` - the hub endpoint's own typed fields, EXACTLY today's
    // formula and addition order (item 7 nit fix: a reordered-but-mathematically-equal
    // expression could differ at the float ULP level - this stays bit-identical to pre-phase-4
    // behaviour, verified by `cable-length-estimate-calculator.test.ts`'s literal HEAD values).
    hubDropM = Math.abs(settings.routeHeightM - hub.mountHeightM)
    hubExtraM = hub.extraLengthM
    fixedM = deviceRiseM + hubDropM + hubExtraM + slackM
    run = {
      nominal: horizM + fixedM,
      min: minFactor === null ? null : horizM * minFactor + fixedM,
      max: maxFactor === null ? null : horizM * maxFactor + fixedM,
    }
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
    ...(beyondVia !== undefined ? { beyondVia } : {}),
    slackM,
    fixedM,
    run,
    wasteM: purchase.nominal - run.nominal,
    purchase,
    limitStatus: limitStatusOf(run, type.lengthLimitM),
  }
}
