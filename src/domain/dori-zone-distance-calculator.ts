/**
 * EN 62676-4 DORI (Detect/Observe/Recognise/Identify) distance math.
 *
 * DORI thresholds are expressed as pixel density on the target (px/m), not
 * as a fixed real-world distance: `DORI_PX_PER_METER` says how many of the
 * camera's horizontal pixels must land on each metre of the target at the
 * threshold distance. This is unrelated to `planPxPerMeter` (image scale
 * from calibration, in scale-calibration-calculator.ts) - never mix them.
 */
export const DORI_PX_PER_METER = {
  detect: 25,
  observe: 62.5,
  recognize: 125,
  identify: 250,
} as const

export type DoriZone = keyof typeof DORI_PX_PER_METER

export interface DoriDistancesM {
  detect: number
  observe: number
  recognize: number
  identify: number
}

/**
 * HFOV >= 180deg cannot use the rectilinear tan() formula (it diverges to
 * infinity approaching 180deg), so an arc-length approximation takes over.
 * This produces a real discontinuity at exactly 180deg - documented by a
 * test, not hidden.
 */
export function isApproximateDoriModel(hfovDeg: number): boolean {
  return hfovDeg >= 180
}

/**
 * Distance (m) at which a target crosses each DORI pixel-density threshold.
 *
 * `pixelWidth` = horizontal resolution (H), `hfovDeg` = effective horizontal
 * field of view in degrees.
 *
 * - Rectilinear (HFOV < 180): d = H / (2 * ppm * tan(HFOV/2))
 * - Arc model   (HFOV >= 180): d = H / (ppm * HFOV_rad)
 */
export function computeDoriDistancesM(pixelWidth: number, hfovDeg: number): DoriDistancesM {
  if (!Number.isFinite(pixelWidth) || pixelWidth <= 0) {
    throw new Error(`pixelWidth must be a positive finite number, got ${pixelWidth}`)
  }
  if (!Number.isFinite(hfovDeg) || hfovDeg <= 0 || hfovDeg > 360) {
    throw new Error(`hfovDeg must be within (0, 360], got ${hfovDeg}`)
  }

  const approximate = isApproximateDoriModel(hfovDeg)
  const hfovRad = (hfovDeg * Math.PI) / 180
  const halfHfovRad = hfovRad / 2

  const distanceForPpm = (ppm: number): number =>
    approximate ? pixelWidth / (ppm * hfovRad) : pixelWidth / (2 * ppm * Math.tan(halfHfovRad))

  return {
    detect: distanceForPpm(DORI_PX_PER_METER.detect),
    observe: distanceForPpm(DORI_PX_PER_METER.observe),
    recognize: distanceForPpm(DORI_PX_PER_METER.recognize),
    identify: distanceForPpm(DORI_PX_PER_METER.identify),
  }
}
