import { z } from 'zod'
import { MIN_BEAM_LENGTH_PX, type PlacedBeamSensor, type PlacedSensor, type SensorPlacementShape } from './sensor-types'

/** Mirrors `MAX_CAMERAS`/`MAX_WALLS`'s generous-but-bounded intent. */
export const MAX_SENSORS = 500

const SENSOR_ID_MAX_LENGTH = 100
const SENSOR_COORD_LIMIT_PX = 1_000_000
const coord = z.number().finite().gte(-SENSOR_COORD_LIMIT_PX).lte(SENSOR_COORD_LIMIT_PX)

const sensorBaseFields = {
  id: z.string().min(1).max(SENSOR_ID_MAX_LENGTH),
  // No real catalog id gets anywhere near this cap (longest today is well under 40 chars), so
  // this is defence in depth against a hand-edited/malicious file, not a day-to-day constraint.
  modelId: z.string().min(1).max(SENSOR_ID_MAX_LENGTH),
  x: coord,
  y: coord,
}

/**
 * On-disk shape of a placed sensor. `environment` is optional here (a file
 * may omit it) even though `PlacedBeamSensor.environment` is always present
 * in memory - `normaliseLoadedSensors` below fills the default. Everything
 * else matches `sensor-types.ts`'s `PlacedSensor` exactly.
 */
export const placedSensorSchema = z.discriminatedUnion('shape', [
  z.strictObject({
    ...sensorBaseFields,
    shape: z.literal('sector'),
    rotationDeg: z.number().finite(),
    rangeM: z.number().finite().gt(0).lte(5000),
    angleDeg: z.number().finite().gt(0).lte(360).optional(),
  }),
  z.strictObject({
    ...sensorBaseFields,
    shape: z.literal('circle'),
    radiusM: z.number().finite().gt(0).lte(500),
  }),
  z.strictObject({
    ...sensorBaseFields,
    shape: z.literal('beam'),
    x2: coord,
    y2: coord,
    environment: z.enum(['indoor', 'outdoor']).optional(),
  }),
])

export type LoadedPlacedSensor = z.infer<typeof placedSensorSchema>

/**
 * What the file parser needs to know about one catalog model: the placed
 * shape its kind draws as (to catch a shape/model mismatch in a hand-edited
 * file), and - beam models only - the default `environment` computed from
 * the model's printed max distances (`defaultBeamEnvironment` in
 * `sensor-types.ts`). Built once by the caller (`use-project-file-actions.ts`,
 * which may import `src/catalog`; this domain module never does) from the
 * bundled `sensorModels` + `sensorPlacementShape`.
 */
export interface SensorModelLookupEntry {
  shape: SensorPlacementShape
  /** Only read when `shape === 'beam'`. */
  defaultBeamEnvironment?: 'indoor' | 'outdoor'
}

export type SensorModelLookup = ReadonlyMap<string, SensorModelLookupEntry>

function withDefaultBeamEnvironment(sensor: LoadedPlacedSensor & { shape: 'beam' }, entry: SensorModelLookupEntry): PlacedBeamSensor {
  return { ...sensor, environment: sensor.environment ?? entry.defaultBeamEnvironment ?? 'outdoor' }
}

/**
 * Drops a loaded sensor, each with one warning string, when: its `modelId`
 * is unknown; its `shape` does not match that model's catalog shape; its
 * `id` repeats an earlier sensor; or (beam only) its two ends are closer
 * than `MIN_BEAM_LENGTH_PX`. A kept beam missing `environment` gets the
 * model's default. Mirrors `normaliseLoadedWalls`'s drop-with-warning shape.
 */
export function normaliseLoadedSensors(
  sensors: readonly LoadedPlacedSensor[],
  modelLookup: SensorModelLookup,
  warnings: string[],
): PlacedSensor[] {
  const seenIds = new Set<string>()
  const kept: PlacedSensor[] = []

  for (const sensor of sensors) {
    const entry = modelLookup.get(sensor.modelId)
    if (!entry) {
      warnings.push(`Sensor "${sensor.id}" references unknown model "${sensor.modelId}"; dropped.`)
      continue
    }
    if (entry.shape !== sensor.shape) {
      warnings.push(
        `Sensor "${sensor.id}" has shape "${sensor.shape}" but model "${sensor.modelId}" is "${entry.shape}"; dropped.`,
      )
      continue
    }
    if (seenIds.has(sensor.id)) {
      warnings.push(`Sensor id "${sensor.id}" is used more than once; the repeat was dropped.`)
      continue
    }
    if (sensor.shape === 'beam' && Math.hypot(sensor.x2 - sensor.x, sensor.y2 - sensor.y) < MIN_BEAM_LENGTH_PX) {
      warnings.push(`Sensor "${sensor.id}" has a zero-length beam; dropped.`)
      continue
    }

    seenIds.add(sensor.id)
    kept.push(sensor.shape === 'beam' ? withDefaultBeamEnvironment(sensor, entry) : sensor)
  }

  return kept
}
