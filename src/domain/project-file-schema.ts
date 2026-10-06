import { z } from 'zod'
import {
  MOUNT_HEIGHT_MAX_M,
  MOUNT_HEIGHT_MIN_M,
  TILT_MAX_DEG,
  TILT_MIN_DEG,
} from './mounted-camera-ground-coverage-calculator'
import type { PlacedCamera, Project } from './project-types'
import { MAX_SENSORS, normaliseLoadedSensors, placedSensorSchema, type SensorModelLookup } from './project-file-sensor-schema'
import { MAX_WALLS, normaliseLoadedWalls, wallSchema } from './project-file-wall-schema'

export { MAX_WALLS, WALLS_CROSS_WARNING } from './project-file-wall-schema'
export { MAX_SENSORS } from './project-file-sensor-schema'
export type { SensorModelLookup, SensorModelLookupEntry } from './project-file-sensor-schema'

/**
 * Version written to saved files. Bumped whenever a file saved by this build
 * could not be opened by an older one. Version 2 = version 1 plus the optional
 * camera keys `mountHeightM` / `tiltDeg`; version 3 = version 2 plus the
 * optional top-level `walls`; version 4 = version 3 plus the optional
 * top-level `sensors`. Each is a strict superset, so older files are read
 * with the same schema and need no migration. The writer always emits v4,
 * even for a project with no sensors (owner decision: one writer path) - a v4
 * file will not open in a pre-sensor build.
 */
export const PROJECT_SCHEMA_VERSION = 4 as const

/** Mirrors `serializeCsv`'s input cap intent: generous for a floor-plan PNG, small enough to reject garbage quickly. */
const MAX_PROJECT_TEXT_LENGTH_BYTES = 80 * 1024 * 1024 // 80 MB

const DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/

const planImageSchema = z.strictObject({
  dataUrl: z
    .string()
    .max(MAX_PROJECT_TEXT_LENGTH_BYTES)
    .regex(DATA_URL_PATTERN, 'image must be a base64 data:image/png or data:image/jpeg URL'),
  widthPx: z.number().int().min(1).max(32767),
  heightPx: z.number().int().min(1).max(32767),
  fileName: z.string().min(1).max(260),
})

const refLineSchema = z.strictObject({
  x1: z.number().finite(),
  y1: z.number().finite(),
  x2: z.number().finite(),
  y2: z.number().finite(),
})

const scaleCalibrationSchema = z.strictObject({
  planPxPerMeter: z.number().finite().gt(0),
  refLine: refLineSchema,
  refLengthM: z.number().finite().gt(0),
})

const placedCameraSchema = z
  .strictObject({
    id: z.string().min(1),
    modelId: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
    rotationDeg: z.number().finite(),
    hfovDeg: z.number().finite().gt(0).lte(360).optional(),
    rangeM: z.number().finite().gt(0).lte(500),
    mountHeightM: z.number().finite().gte(MOUNT_HEIGHT_MIN_M).lte(MOUNT_HEIGHT_MAX_M).optional(),
    tiltDeg: z.number().finite().gte(TILT_MIN_DEG).lte(TILT_MAX_DEG).optional(),
  })
  .refine((camera) => (camera.mountHeightM === undefined) === (camera.tiltDeg === undefined), {
    message: 'mountHeightM and tiltDeg must be set together',
    path: ['tiltDeg'],
  })

const MAX_CAMERAS = 500

const projectFileSchema = z.strictObject({
  app: z.literal('camera-layout-tool'),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(PROJECT_SCHEMA_VERSION)]),
  image: planImageSchema,
  scale: scaleCalibrationSchema.nullable(),
  cameras: z.array(placedCameraSchema).max(MAX_CAMERAS),
  walls: z.array(wallSchema).max(MAX_WALLS).optional(),
  sensors: z.array(placedSensorSchema).max(MAX_SENSORS).optional(),
})

/** Serialises a project to the on-disk JSON shape (adds the `app`/`schemaVersion` envelope). */
export function serializeProject(project: Project): string {
  return JSON.stringify({
    app: 'camera-layout-tool',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    image: project.image,
    scale: project.scale,
    cameras: project.cameras,
    walls: project.walls,
    sensors: project.sensors,
  })
}

function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  const path = first.path.length > 0 ? first.path.join('.') : '(root)'
  return `${path}: ${first.message}`
}

export type ParseProjectResult =
  | { ok: true; project: Project; warnings: string[] }
  | { ok: false; error: string }

/**
 * Parses untrusted project-file text. This is the single trust boundary for
 * loaded JSON: size cap, strict schema (rejects unknown keys and any
 * non-finite number), image restricted to inline PNG/JPEG data URLs,
 * camera/model cross-check against the caller's known catalog ids, wall
 * normalisation (a file without `walls` loads with none) and sensor
 * normalisation against `sensorModelLookup` (a file without `sensors` loads
 * with none). Never throws - every failure mode returns `{ ok: false, error }`.
 */
export function parseProjectFile(
  text: string,
  knownModelIds: ReadonlySet<string>,
  sensorModelLookup: SensorModelLookup,
): ParseProjectResult {
  try {
    if (text.length > MAX_PROJECT_TEXT_LENGTH_BYTES) {
      return {
        ok: false,
        error: `Project file is too large (${text.length} bytes, max ${MAX_PROJECT_TEXT_LENGTH_BYTES}).`,
      }
    }

    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return { ok: false, error: 'Project file is not valid JSON.' }
    }

    const result = projectFileSchema.safeParse(raw)
    if (!result.success) {
      return { ok: false, error: `Invalid project file: ${formatZodError(result.error)}` }
    }

    const warnings: string[] = []
    const cameras: PlacedCamera[] = result.data.cameras.filter((camera) => {
      if (knownModelIds.has(camera.modelId)) return true
      warnings.push(`Camera "${camera.id}" references unknown model "${camera.modelId}"; dropped.`)
      return false
    })

    const project: Project = {
      image: result.data.image,
      scale: result.data.scale,
      cameras,
      walls: normaliseLoadedWalls(result.data.walls ?? [], warnings),
      sensors: normaliseLoadedSensors(result.data.sensors ?? [], sensorModelLookup, warnings),
    }

    return { ok: true, project, warnings }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error parsing project file.' }
  }
}
