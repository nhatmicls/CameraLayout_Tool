import type { PlacedBeamSensor, PlacedCircleSensor, PlacedSensor, PlacedSensorPatch, PlacedSectorSensor } from './sensor-types'

/**
 * Copies `patch[key]` into `fields[key]` only when it is both present AND
 * different from `current[key]` - the building block that makes a
 * same-value patch a true no-op (so re-typing the same number, clicking the
 * already-active Indoor/Outdoor button, or Reset at the default never add a
 * no-op undo step).
 */
function copyIfChanged<T, K extends keyof T>(fields: Partial<T>, current: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined && value !== current[key]) fields[key] = value
}

/**
 * Returns a new sensor with `patch`'s keys applied, ignoring any key that
 * does not belong to `sensor.shape` (e.g. a `radiusM` patch on a sector
 * sensor is a no-op) AND any key whose value already equals the sensor's
 * current one. Returns `sensor` itself (same reference) when nothing in
 * `patch` actually changes anything - including not disturbing undo-history
 * reference equality, the same contract `updateWall` relies on in
 * `project-store.ts`.
 */
export function applyPlacedSensorPatch(sensor: PlacedSensor, patch: PlacedSensorPatch): PlacedSensor {
  const common: Partial<Pick<PlacedSensor, 'x' | 'y'>> = {}
  copyIfChanged(common, sensor, 'x', patch.x)
  copyIfChanged(common, sensor, 'y', patch.y)

  if (sensor.shape === 'sector') {
    const fields: Partial<Pick<PlacedSectorSensor, 'rotationDeg' | 'rangeM' | 'angleDeg'>> = {}
    copyIfChanged(fields, sensor, 'rotationDeg', patch.rotationDeg)
    copyIfChanged(fields, sensor, 'rangeM', patch.rangeM)
    copyIfChanged(fields, sensor, 'angleDeg', patch.angleDeg)
    if (Object.keys(common).length === 0 && Object.keys(fields).length === 0) return sensor
    return { ...sensor, ...common, ...fields }
  }

  if (sensor.shape === 'circle') {
    const fields: Partial<Pick<PlacedCircleSensor, 'radiusM'>> = {}
    copyIfChanged(fields, sensor, 'radiusM', patch.radiusM)
    if (Object.keys(common).length === 0 && Object.keys(fields).length === 0) return sensor
    return { ...sensor, ...common, ...fields }
  }

  const fields: Partial<Pick<PlacedBeamSensor, 'x2' | 'y2' | 'environment'>> = {}
  copyIfChanged(fields, sensor, 'x2', patch.x2)
  copyIfChanged(fields, sensor, 'y2', patch.y2)
  copyIfChanged(fields, sensor, 'environment', patch.environment)
  if (Object.keys(common).length === 0 && Object.keys(fields).length === 0) return sensor
  return { ...sensor, ...common, ...fields }
}
