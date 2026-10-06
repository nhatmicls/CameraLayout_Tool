import type { ThermalDriM } from './sensor-types'

export type ThermalDriZone = 'identify' | 'recognize' | 'detect'

export interface ThermalDriBand {
  zone: ThermalDriZone
  /** Metres from the sensor, nearest edge of the band. */
  innerM: number
  /** Metres from the sensor, farthest edge of the band. */
  outerM: number
}

/** Nearest-to-farthest: identify is always the smallest printed distance, detect the largest (catalog-enforced). */
const ZONE_ORDER: ReadonlyArray<{ zone: ThermalDriZone; distanceKey: keyof ThermalDriM }> = [
  { zone: 'identify', distanceKey: 'identify' },
  { zone: 'recognize', distanceKey: 'recognize' },
  { zone: 'detect', distanceKey: 'detect' },
]

/**
 * Orders one thermal lens's D/R/I bands nearest-to-farthest (identify ->
 * recognize -> detect), each clipped to `rangeM` (the user's drawn cone,
 * which may be smaller than the datasheet distances - `rangeM` is itself
 * clamped by `resolveSensorAreaCoverage`). Zero-width bands are dropped
 * (e.g. `rangeM` smaller than the identify distance drops recognize and
 * detect entirely). Throws on a non-positive/non-finite `rangeM`, the same
 * contract `computeDoriBands` uses.
 *
 * Deliberately NOT `computeDoriBands`: that function is keyed on DORI zones
 * derived from pixel density/HFOV (camera catalog), not a printed D/R/I
 * triple - mixing the two would mix DORI px/m with plain metres, which
 * CLAUDE.md forbids.
 */
export function computeThermalDriBands(dri: ThermalDriM, rangeM: number): ThermalDriBand[] {
  if (!Number.isFinite(rangeM) || rangeM <= 0) {
    throw new Error(`rangeM must be a positive finite number, got ${rangeM}`)
  }

  const bands: ThermalDriBand[] = []
  let innerM = 0
  for (const { zone, distanceKey } of ZONE_ORDER) {
    const outerM = Math.min(dri[distanceKey], rangeM)
    if (outerM > innerM) {
      bands.push({ zone, innerM, outerM })
    }
    innerM = Math.max(innerM, outerM)
  }
  return bands
}
