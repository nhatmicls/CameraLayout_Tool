import type { CameraLensSpec, CameraModelSpec } from '../project-file/project-types'
import {
  computeDoriDistancesM,
  isApproximateDoriModel,
  type DoriDistancesM,
} from './dori-zone-distance-calculator'

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

function resolveDatasheetVfovDeg(lens: CameraLensSpec, effectiveHfovDeg: number): EffectiveVfov | null {
  if (lens.kind === 'fixed') {
    return lens.vfovDeg === undefined ? null : { vfovDeg: lens.vfovDeg, source: 'datasheet' }
  }
  const { hfovWideDeg, hfovTeleDeg, vfovWideDeg, vfovTeleDeg } = lens
  if (vfovWideDeg === undefined || vfovTeleDeg === undefined || hfovWideDeg <= hfovTeleDeg) {
    return null
  }
  const zoomFraction = Math.min(Math.max((effectiveHfovDeg - hfovTeleDeg) / (hfovWideDeg - hfovTeleDeg), 0), 1)
  return {
    vfovDeg: vfovTeleDeg + zoomFraction * (vfovWideDeg - vfovTeleDeg),
    source: zoomFraction === 0 || zoomFraction === 1 ? 'datasheet' : 'datasheet-interpolated',
  }
}

/**
 * Where an effective vertical FOV came from: printed on the datasheet,
 * linearly interpolated between the datasheet's wide and tele values
 * (varifocal mid-zoom), or derived from HFOV and the sensor aspect ratio.
 */
export type VfovSource = 'datasheet' | 'datasheet-interpolated' | 'computed'

export interface EffectiveVfov {
  vfovDeg: number
  source: VfovSource
}

/**
 * Effective vertical FOV for a camera at `effectiveHfovDeg` (already clamped
 * by `resolveEffectiveHfovDeg`). Datasheet value when the lens carries one;
 * otherwise the rectilinear derivation 2*atan(tan(hfov/2) * height/width),
 * which is never stored. Returns null when there is no datasheet value and
 * HFOV >= 180deg: the derivation diverges there, and the fisheye coverage
 * path needs no VFOV.
 *
 * Guarantee the floor-coverage geometry relies on: for HFOV < 180deg the
 * result is always inside (0, 180). A datasheet value of 180deg or more on
 * such a lens is not usable there, so the derivation is used instead.
 */
export function resolveEffectiveVfovDeg(
  lens: CameraLensSpec,
  pixelWidth: number,
  pixelHeight: number,
  effectiveHfovDeg: number,
): EffectiveVfov | null {
  const fisheye = isApproximateDoriModel(effectiveHfovDeg)
  const datasheet = resolveDatasheetVfovDeg(lens, effectiveHfovDeg)
  if (datasheet && (fisheye || datasheet.vfovDeg < 180)) {
    return datasheet
  }
  if (fisheye) {
    return null
  }
  const halfHfovRad = (effectiveHfovDeg * Math.PI) / 360
  const halfVfovRad = Math.atan((Math.tan(halfHfovRad) * pixelHeight) / pixelWidth)
  return { vfovDeg: (halfVfovRad * 360) / Math.PI, source: 'computed' }
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
 *
 * `startM` is the nearest covered distance (blind-spot radius of a mounted
 * camera): bands begin there, and a zone ending inside it is dropped. Returns
 * [] when `startM >= rangeM`.
 */
export function computeDoriBands(distances: DoriDistancesM, rangeM: number, startM = 0): DoriBand[] {
  if (!Number.isFinite(rangeM) || rangeM <= 0) {
    throw new Error(`rangeM must be a positive finite number, got ${rangeM}`)
  }
  if (!Number.isFinite(startM) || startM < 0) {
    throw new Error(`startM must be a non-negative finite number, got ${startM}`)
  }
  if (startM >= rangeM) {
    return []
  }

  const bands: DoriBand[] = []
  let innerM = startM
  for (const { zone, distanceKey } of ZONE_ORDER) {
    const outerM = Math.min(distances[distanceKey], rangeM)
    if (outerM > innerM) {
      bands.push({ zone, innerM, outerM })
    }
    // max(): a zone ending inside the blind spot must not pull the cursor below startM.
    innerM = Math.max(innerM, outerM)
  }

  if (rangeM > distances.detect) {
    bands.push({ zone: 'beyond-detect', innerM: Math.max(distances.detect, startM), outerM: rangeM })
  }

  return bands
}
