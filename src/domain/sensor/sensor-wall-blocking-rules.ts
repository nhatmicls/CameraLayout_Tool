import type { Wall, WallKind } from '../project-file/project-types'
import type { PlacedSensor, SensorKind, SensorModelSpec } from './sensor-types'

/**
 * Which wall kinds occlude which sensor kind. The single place the "glass
 * blocks PIR/thermal" assumption lives - flip a row here if a product
 * proves it wrong. `beam` is intentionally absent from
 * the glass list: an IR beam is stopped by an opaque wall but passes
 * through glass (with a note, drawn by `beam-sensor-line-check.ts`'s
 * `crossesGlass` flag), not clipped like the other three kinds.
 */
export const SENSOR_BLOCKING_WALL_KINDS: Record<SensorKind, readonly WallKind[]> = {
  pir: ['opaque', 'glass'],
  thermal: ['opaque', 'glass'],
  vibration: ['opaque'],
  beam: ['opaque'],
}

/**
 * True when at least one glass wall in `walls` could actually clip at least
 * one of `sensors` (i.e. a sensor whose model is known and whose kind's
 * blocking list includes 'glass' - pir/thermal today). Used by the PNG
 * export to decide whether its "Walls: 2D" note must appear
 * for a glass-only plan: unlike an opaque wall (noted unconditionally, since
 * it always COULD block a camera), a glass wall is otherwise completely
 * inert, so the note should only appear when there is something on the plan
 * it actually clips.
 */
export function hasGlassWallClippingAnySensor(
  walls: readonly Wall[],
  sensors: readonly PlacedSensor[],
  sensorModelById: Record<string, SensorModelSpec>,
): boolean {
  if (!walls.some((wall) => wall.kind === 'glass')) return false
  return sensors.some((sensor) => {
    const model = sensorModelById[sensor.modelId]
    return model !== undefined && SENSOR_BLOCKING_WALL_KINDS[model.kind].includes('glass')
  })
}
