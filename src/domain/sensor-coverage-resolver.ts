import { computeThermalDriBands, type ThermalDriZone } from './thermal-dri-band-calculator'
import type { BeamModelSpec, PlacedCircleSensor, PlacedSectorSensor, SensorModelSpec } from './sensor-types'

export type SensorCoverageBandKey = 'coverage' | ThermalDriZone

export interface SensorAreaCoverageBand {
  key: SensorCoverageBandKey
  /** Metres from the sensor, nearest edge of the band. */
  innerM: number
  /** Metres from the sensor, farthest edge of the band. */
  outerM: number
}

export interface SensorAreaCoverage {
  /** Full sweep angle in degrees; 360 = a full circle. */
  angleDeg: number
  maxRangeM: number
  bands: SensorAreaCoverageBand[]
}

/**
 * Resolves a placed sector/circle sensor's drawable coverage against its
 * catalog model, clamping every effective value inside the datasheet's
 * printed limits regardless of what the placed sensor's own fields say (a
 * hand-edited project file is still bounded by `project-file-sensor-schema.ts`,
 * but this is the second, datasheet-aware line of defence the plan calls
 * for). Returns `null` when `spec.kind`/`sensor.shape` do not correspond to
 * the same placement shape (`sensorPlacementShape` mismatch) - the caller's
 * bug, not a user error, so there is no warning to report here.
 */
export function resolveSensorAreaCoverage(
  spec: SensorModelSpec,
  sensor: PlacedSectorSensor | PlacedCircleSensor,
): SensorAreaCoverage | null {
  if (spec.kind === 'pir' && sensor.shape === 'sector') {
    const maxRangeM = Math.min(sensor.rangeM, spec.coverage.rangeM)
    const angleDeg = sensor.angleDeg === undefined ? spec.coverage.angleDeg : Math.min(sensor.angleDeg, spec.coverage.angleDeg)
    return { angleDeg, maxRangeM, bands: [{ key: 'coverage', innerM: 0, outerM: maxRangeM }] }
  }

  if (spec.kind === 'thermal' && sensor.shape === 'sector') {
    // Angle is never a user override for thermal - it is always the printed HFOV.
    const maxRangeM = Math.min(sensor.rangeM, spec.detectionRangeM.human.detect)
    const bands = computeThermalDriBands(spec.detectionRangeM.human, maxRangeM).map(
      (band): SensorAreaCoverageBand => ({ key: band.zone, innerM: band.innerM, outerM: band.outerM }),
    )
    return { angleDeg: spec.hfovDeg, maxRangeM, bands }
  }

  if (spec.kind === 'vibration' && sensor.shape === 'circle') {
    const largestPrintedRadiusM = Math.max(...spec.radii.map((row) => row.radiusM))
    const maxRangeM = Math.min(sensor.radiusM, largestPrintedRadiusM)
    return { angleDeg: 360, maxRangeM, bands: [{ key: 'coverage', innerM: 0, outerM: maxRangeM }] }
  }

  return null
}

export interface BeamMaxDistance {
  /** The limit the over-distance check uses: the figure for `environment`, falling back to the other figure when that one is not printed. */
  limitM: number
  outdoorM: number | null
  indoorM: number | null
}

/**
 * The beam's over-distance limit for the placement's chosen `environment`
 * (owner decision: a per-beam indoor/outdoor switch, not "use the
 * smaller figure"). Falls back to the other printed figure when the chosen
 * one is null - the catalog schema guarantees at least one is printed.
 */
export function resolveBeamMaxDistanceM(spec: BeamModelSpec, environment: 'indoor' | 'outdoor'): BeamMaxDistance {
  const { maxDistanceOutdoorM, maxDistanceIndoorM } = spec
  const chosen = environment === 'indoor' ? maxDistanceIndoorM : maxDistanceOutdoorM
  const fallback = environment === 'indoor' ? maxDistanceOutdoorM : maxDistanceIndoorM
  const limitM = chosen ?? fallback
  if (limitM === null) {
    throw new Error('beam model has neither maxDistanceOutdoorM nor maxDistanceIndoorM printed')
  }
  return { limitM, outdoorM: maxDistanceOutdoorM, indoorM: maxDistanceIndoorM }
}
