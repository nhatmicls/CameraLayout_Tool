import { sensorModels } from '../../catalog/sensor/sensor-catalog-loader'
import type { SensorModelSpec } from '../../domain/sensor/sensor-types'

/**
 * `groupSensorsIntoBom` (phase 7) takes a plain `Record<string, SensorModelSpec>`
 * on purpose - keeps the domain layer catalog-agnostic, the sensor twin of
 * `buildCameraModelByIdRecord`. The static catalog never changes at runtime,
 * so this is cheap to call per export.
 */
export function buildSensorModelByIdRecord(): Record<string, SensorModelSpec> {
  return Object.fromEntries(sensorModels.map((model) => [model.id, model]))
}
