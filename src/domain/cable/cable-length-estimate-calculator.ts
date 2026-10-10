import { planPxToMeters } from '../shared/scale-calibration-calculator'
import type { ScaleUncertainty } from './cable-scale-uncertainty'
import { cableEndRefKey, resolveCableEnd, resolveCablePathPx, type CableEndpointIndex } from './cable-endpoint-index'
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
 * - A cable may end on a device instead of a hub: the end then rises to that
 *   device's height and takes the device-end slack, like the start.
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
  /** Typed mode: `|routeHeightM - hub height|` (or the end device's height, for a cable ending on a device). Computed (route) mode: just the floor-height crossing - see `hubExtraM`/`beyondVia`. */
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
 * null = the cable is dangling (its start device or its end no longer exists).
 * `planPxPerMeter` must be the calibrated scale - never a fallback.
 *
 * `beyond` is this cable's resolved `HubBeyondLength` (`resolveCableBeyondLengths`),
 * for a cable ending on a hub. Omitted = typed mode using the hub endpoint's
 * own fields. `source: 'typed'` is the same formula, reached explicitly.
 * `source: 'route'` is the computed mode: `hubDropM` becomes just the
 * floor-height crossing, `hubExtraM` the route on the other floor + whatever
 * is beyond where it ends, and `beyondVia` names where that leads. The
 * caller never passes `source: 'unavailable'` here - it is filtered out one
 * layer up (`computeCableLayoutEstimate`), which counts and warns instead.
 */
export function estimateCableLength(input: {
  cable: Cable
  index: CableEndpointIndex
  type: CableType
  settings: CableSettings
  planPxPerMeter: number
  uncertainty: ScaleUncertainty
  beyond?: HubBeyondLength
  /** The cable's end-to-end label (`buildProjectCableEndToEndLabels`) - just echoed into the result, never computed here. */
  label: string
}): CableLengthEstimate | null {
  const { cable, index, type, settings, planPxPerMeter, uncertainty, beyond, label } = input
  const path = resolveCablePathPx(cable, index)
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const end = resolveCableEnd(cable, index)
  if (!path || !device || !end) return null

  const horizPx = polylineLengthPx(path)
  const horizM = planPxToMeters(horizPx, planPxPerMeter)
  const deviceHeightM = device.mountHeightM ?? settings.defaultDeviceHeightM
  const deviceRiseM = Math.abs(settings.routeHeightM - deviceHeightM)
  // The far end takes the device-end slack when the cable finally lands on a device - directly,
  // or at the end of its own leg beyond a shaft.
  const landsOnDevice = end.kind === 'device' || (beyond?.source === 'route' && beyond.endsOnDevice === true)
  const slackM = settings.deviceEndSlackM + (landsOnDevice ? settings.deviceEndSlackM : settings.hubEndSlackM)

  const { minFactor, maxFactor } = uncertainty
  let hubDropM: number
  let hubExtraM: number
  let beyondVia: string | undefined
  let fixedM: number
  let run: MetersInterval

  if (end.kind === 'hub' && (beyond?.source === 'route' || (beyond?.source === 'typed' && beyond.shaftNotRouted))) {
    // Route: floor crossing + the route on the other floor + whatever is past it. Shaft opening
    // not routed yet: 0 m AT the opening + its typed `extraLengthM`, no `routeHeightM` term -
    // `beyond.run` already holds exactly that (`typedBeyond`), and an opening's `mountHeightM`
    // (always 0) must NOT go through the riser / drop / plain hub formula below.
    hubDropM = beyond.source === 'route' ? beyond.crossingVerticalM : 0
    hubExtraM = beyond.run.nominal - hubDropM
    if (beyond.source === 'route') beyondVia = beyond.viaLabel
    fixedM = deviceRiseM + slackM + beyond.run.nominal
    run = {
      nominal: horizM + fixedM,
      min: minFactor === null || beyond.run.min === null ? null : horizM * minFactor + deviceRiseM + slackM + beyond.run.min,
      max: maxFactor === null || beyond.run.max === null ? null : horizM * maxFactor + deviceRiseM + slackM + beyond.run.max,
    }
  } else {
    // A device end, or a riser / drop / plain hub in typed mode (`beyond` undefined or
    // `source: 'typed'`) - the end's own typed fields. The hub formula and its addition order are
    // kept EXACTLY (a reordered-but-equal expression could differ at the float ULP level; verified
    // by `cable-length-estimate-calculator.test.ts`'s literal values).
    if (end.kind === 'device') {
      hubDropM = Math.abs(settings.routeHeightM - (end.device.mountHeightM ?? settings.defaultDeviceHeightM))
      hubExtraM = 0
    } else {
      hubDropM = Math.abs(settings.routeHeightM - end.hub.mountHeightM)
      hubExtraM = end.hub.extraLengthM
    }
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
    label,
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
