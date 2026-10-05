/**
 * Floor coverage of a camera mounted at a height and tilted downward.
 *
 * Everything here is metres and degrees on the floor plane - no
 * `planPxPerMeter` (that conversion happens at the render edge).
 *
 * Approximations, stated in the UI and README:
 * - Near / far edges are centre-line values, drawn as arc radii. The true
 *   footprint of a tilted rectilinear camera is a trapezoid.
 * - DORI thresholds use the slant model: a threshold at slant distance d from
 *   the lens lands on the floor at sqrt(d^2 - h^2), independent of tilt.
 * - Fisheye (HFOV >= 180deg): tilt is not applicable, there is no blind spot
 *   and the far edge is the configured range.
 */
import { computeDoriBands, type DoriBand } from './camera-coverage-resolver'
import { isApproximateDoriModel, type DoriDistancesM } from './dori-zone-distance-calculator'

export const MOUNT_HEIGHT_MIN_M = 0.5
export const MOUNT_HEIGHT_MAX_M = 30
export const TILT_MIN_DEG = 0
export const TILT_MAX_DEG = 90
export const DEFAULT_MOUNT_HEIGHT_M = 2.7

const DEG_TO_RAD = Math.PI / 180

function assertMountHeightM(mountHeightM: number): void {
  if (!Number.isFinite(mountHeightM) || mountHeightM <= 0) {
    throw new Error(`mountHeightM must be a positive finite number, got ${mountHeightM}`)
  }
}

function assertVfovDeg(vfovDeg: number): void {
  if (!Number.isFinite(vfovDeg) || vfovDeg <= 0 || vfovDeg >= 180) {
    throw new Error(`vfovDeg must be within (0, 180), got ${vfovDeg}`)
  }
}

export interface GroundCoverageEdgesM {
  /** Blind-spot radius: floor distance where the lower edge of the view lands. 0 when the view reaches straight down. */
  nearM: number
  /** Floor distance where the upper edge of the view lands. Infinity when that edge is at or above the horizon. */
  farM: number
}

/** near = h / tan(tilt + vfov/2), far = h / tan(tilt - vfov/2), along the optical-axis centre line. */
export function computeGroundCoverageEdgesM(
  mountHeightM: number,
  tiltDeg: number,
  vfovDeg: number,
): GroundCoverageEdgesM {
  assertMountHeightM(mountHeightM)
  if (!Number.isFinite(tiltDeg) || tiltDeg < TILT_MIN_DEG || tiltDeg > TILT_MAX_DEG) {
    throw new Error(`tiltDeg must be within [${TILT_MIN_DEG}, ${TILT_MAX_DEG}], got ${tiltDeg}`)
  }
  assertVfovDeg(vfovDeg)

  // Branch on the angle itself, never on the tan() result (float noise near 90deg / 0deg).
  const lowerEdgeDeg = tiltDeg + vfovDeg / 2
  const upperEdgeDeg = tiltDeg - vfovDeg / 2
  return {
    nearM: lowerEdgeDeg >= 90 ? 0 : mountHeightM / Math.tan(lowerEdgeDeg * DEG_TO_RAD),
    farM: upperEdgeDeg <= 0 ? Infinity : mountHeightM / Math.tan(upperEdgeDeg * DEG_TO_RAD),
  }
}

/** Floor distance reached by a slant distance from the lens. null = does not reach the floor (slantM <= mountHeightM). */
export function slantToGroundDistanceM(slantM: number, mountHeightM: number): number | null {
  if (!Number.isFinite(slantM) || slantM <= 0) {
    throw new Error(`slantM must be a positive finite number, got ${slantM}`)
  }
  assertMountHeightM(mountHeightM)
  if (slantM <= mountHeightM) {
    return null
  }
  return Math.sqrt(slantM * slantM - mountHeightM * mountHeightM)
}

/** Tilt that puts the far edge at `targetFarM`: atan(h / targetFarM) + vfov/2, clamped to [0, 90]. */
export function suggestTiltDegForFarEdgeM(mountHeightM: number, targetFarM: number, vfovDeg: number): number {
  assertMountHeightM(mountHeightM)
  if (!Number.isFinite(targetFarM) || targetFarM <= 0) {
    throw new Error(`targetFarM must be a positive finite number, got ${targetFarM}`)
  }
  assertVfovDeg(vfovDeg)
  const tiltDeg = Math.atan(mountHeightM / targetFarM) / DEG_TO_RAD + vfovDeg / 2
  return Math.min(Math.max(tiltDeg, TILT_MIN_DEG), TILT_MAX_DEG)
}

/** DORI threshold distances projected onto the floor. null = that zone never reaches the floor. */
export type DoriGroundDistancesM = Record<keyof DoriDistancesM, number | null>

export interface MountedGroundCoverageInput {
  mountHeightM: number
  /** Ignored when `hfovDeg` >= 180. */
  tiltDeg: number
  /** null is allowed only when `hfovDeg` >= 180. */
  vfovDeg: number | null
  hfovDeg: number
  rangeM: number
  /** DORI threshold distances from the lens (`computeDoriDistancesM`). */
  doriSlantM: DoriDistancesM
}

export interface MountedGroundCoverage {
  fisheye: boolean
  /** Blind-spot radius; 0 for fisheye. */
  nearM: number
  /** Infinity when the horizon is in view, or for fisheye. */
  geometricFarM: number
  /** Drawn far edge: min(rangeM, geometricFarM). Always finite. */
  effectiveFarM: number
  doriGroundM: DoriGroundDistancesM
  /** DORI bands clipped to [nearM, effectiveFarM]. [] when nearM >= effectiveFarM. */
  bands: DoriBand[]
}

export function computeMountedGroundCoverage(input: MountedGroundCoverageInput): MountedGroundCoverage {
  const { mountHeightM, tiltDeg, vfovDeg, hfovDeg, rangeM, doriSlantM } = input
  assertMountHeightM(mountHeightM)

  const fisheye = isApproximateDoriModel(hfovDeg)
  let edges: GroundCoverageEdgesM = { nearM: 0, farM: Infinity }
  if (!fisheye) {
    if (vfovDeg === null) {
      throw new Error(`vfovDeg is required when hfovDeg < 180, got hfovDeg ${hfovDeg}`)
    }
    edges = computeGroundCoverageEdgesM(mountHeightM, tiltDeg, vfovDeg)
  }

  const doriGroundM: DoriGroundDistancesM = {
    detect: slantToGroundDistanceM(doriSlantM.detect, mountHeightM),
    observe: slantToGroundDistanceM(doriSlantM.observe, mountHeightM),
    recognize: slantToGroundDistanceM(doriSlantM.recognize, mountHeightM),
    identify: slantToGroundDistanceM(doriSlantM.identify, mountHeightM),
  }

  const effectiveFarM = Math.min(rangeM, edges.farM)
  // An unreachable zone has zero floor extent for banding (its band is dropped).
  const bands = computeDoriBands(
    {
      detect: doriGroundM.detect ?? 0,
      observe: doriGroundM.observe ?? 0,
      recognize: doriGroundM.recognize ?? 0,
      identify: doriGroundM.identify ?? 0,
    },
    effectiveFarM,
    edges.nearM,
  )

  return { fisheye, nearM: edges.nearM, geometricFarM: edges.farM, effectiveFarM, doriGroundM, bands }
}
