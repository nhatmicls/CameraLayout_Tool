/**
 * Which wall kinds occlude which fire-detector kind, drawn from the TCVN
 * coverage circle the same way `SENSOR_BLOCKING_WALL_KINDS` clips a sensor's
 * cone (`wall-occlusion-visibility-polygon.ts`'s clip, applied by canvas
 * code - this table is only the data).
 *
 * All three detector kinds are blocked by BOTH opaque and glass walls: smoke
 * and hot gas are stopped by any full partition, glazed or not, so an
 * unclipped circle would claim coverage of the next room through a glass
 * wall - the unsafe direction. (CO shares the table even though it ships no
 * TCVN row and therefore never draws a circle - keeping the `Record` total
 * means a tenth kind is a compile error here, never a silent fall-through.)
 */
import type { WallKind } from '../project-file/project-types'
import type { FireDetectorKind } from './fire-alarm-device-types'

export const FIRE_DETECTOR_BLOCKING_WALL_KINDS: Record<FireDetectorKind, readonly WallKind[]> = {
  'smoke-detector': ['opaque', 'glass'],
  'heat-detector': ['opaque', 'glass'],
  'co-detector': ['opaque', 'glass'],
}
