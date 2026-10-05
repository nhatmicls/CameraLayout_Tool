import type { CameraLensSpec, CameraModelSpec } from './project-types'
import { computeDoriDistancesM, type DoriDistancesM } from './dori-zone-distance-calculator'

/**
 * Fallback for the camera's displayed/coverage range when the datasheet
 * publishes no illumination range: min(detect distance, this cap).
 * User decision 2026-10-05. Not "30" - that value appears in an earlier
 * draft of the plan and was superseded.
 */
export const DEFAULT_MAX_RANGE_M = 15

/**
 * Effective HFOV for a placed camera: a fixed lens always uses its datasheet
 * value; a varifocal lens clamps the camera's chosen HFOV into
 * [hfovTeleDeg, hfovWideDeg], defaulting to the widest (least zoomed) angle
 * when the camera has no override yet.
 */
export function resolveEffectiveHfovDeg(lens: CameraLensSpec, cameraHfovDeg?: number): number {
  if (lens.kind === 'fixed') {
    return lens.hfovDeg
  }

  const { hfovTeleDeg, hfovWideDeg } = lens
  if (cameraHfovDeg === undefined || !Number.isFinite(cameraHfovDeg)) {
    return hfovWideDeg
  }
  return Math.min(Math.max(cameraHfovDeg, hfovTeleDeg), hfovWideDeg)
}

/**
 * Default coverage range (m) for a camera: the datasheet illumination range
 * when published, otherwise the detect distance capped at
 * `DEFAULT_MAX_RANGE_M`.
 */
export function resolveDefaultRangeM(model: CameraModelSpec, hfovDeg: number): number {
  if (model.illuminationRangeM !== null) {
    return model.illuminationRangeM
  }
  const detectM = computeDoriDistancesM(model.pixelWidth, hfovDeg).detect
  return Math.min(detectM, DEFAULT_MAX_RANGE_M)
}

export type DoriBandZone = 'identify' | 'recognize' | 'observe' | 'detect' | 'beyond-detect'

export interface DoriBand {
  zone: DoriBandZone
  /** Metres from the camera, nearest edge of the band. */
  innerM: number
  /** Metres from the camera, farthest edge of the band. */
  outerM: number
}

const ZONE_ORDER: ReadonlyArray<{ zone: Exclude<DoriBandZone, 'beyond-detect'>; distanceKey: keyof DoriDistancesM }> = [
  { zone: 'identify', distanceKey: 'identify' },
  { zone: 'recognize', distanceKey: 'recognize' },
  { zone: 'observe', distanceKey: 'observe' },
  { zone: 'detect', distanceKey: 'detect' },
]

/**
 * Orders DORI bands closest-to-farthest (identify -> detect), each clipped
 * to the camera's configured `rangeM`. Zero-width bands are dropped (e.g.
 * identify's threshold distance itself exceeds `rangeM`). Appends a
 * `beyond-detect` band when `rangeM` extends past the detect distance - the
 * camera image still "shows" something there, but DORI guarantees nothing.
 */
export function computeDoriBands(distances: DoriDistancesM, rangeM: number): DoriBand[] {
  if (!Number.isFinite(rangeM) || rangeM <= 0) {
    throw new Error(`rangeM must be a positive finite number, got ${rangeM}`)
  }

  const bands: DoriBand[] = []
  let innerM = 0
  for (const { zone, distanceKey } of ZONE_ORDER) {
    const outerM = Math.min(distances[distanceKey], rangeM)
    if (outerM > innerM) {
      bands.push({ zone, innerM, outerM })
    }
    innerM = outerM
  }

  if (rangeM > distances.detect) {
    bands.push({ zone: 'beyond-detect', innerM: distances.detect, outerM: rangeM })
  }

  return bands
}
