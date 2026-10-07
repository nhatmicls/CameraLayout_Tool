import { z } from 'zod'
import {
  MOUNT_HEIGHT_MAX_M,
  MOUNT_HEIGHT_MIN_M,
  TILT_MAX_DEG,
  TILT_MIN_DEG,
} from '../camera/mounted-camera-ground-coverage-calculator'
import { MAX_CABLES, MAX_CABLE_TYPES, MAX_HUBS } from '../cable/cable-layout-types'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../fire-alarm/fire-alarm-device-types'
import type { PlacedCamera, Project } from './project-types'
import { cableSchema, cableSettingsSchema, cableTypeSchema, hubSchema, normaliseLoadedCabling } from './project-file-cable-schema'
import { MAX_FIRE_ALARM_DEVICES, fireAlarmSettingsSchema, normaliseLoadedFireAlarmDevices, placedFireAlarmDeviceSchema } from './project-file-fire-alarm-schema'
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
 * top-level `sensors`; version 5 = version 4 plus the optional top-level
 * `hubs` / `cables` / `cableTypes` / `cableSettings`; version 6 = version 5
 * plus the optional top-level `fireAlarmDevices` / `fireAlarmSettings`. Each
 * is a strict superset, so older files are read with the same schema and
 * need no migration. The writer always emits v6, even for a project with no
 * fire-alarm devices (owner decision: one writer path) - a v6 file will not
 * open in a pre-fire-alarm build.
 */
export const PROJECT_SCHEMA_VERSION = 6 as const

/** What the file parser needs to know per model family, so callers (file I/O, tests) pass one object instead of a positional tail that grows with every new device family. */
export interface ProjectFileLookups {
  cameraModelIds: ReadonlySet<string>
  sensorModelLookup: SensorModelLookup
  fireAlarmModelIds: ReadonlySet<string>
}

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
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(PROJECT_SCHEMA_VERSION)]),
  image: planImageSchema,
  scale: scaleCalibrationSchema.nullable(),
  cameras: z.array(placedCameraSchema).max(MAX_CAMERAS),
  walls: z.array(wallSchema).max(MAX_WALLS).optional(),
  sensors: z.array(placedSensorSchema).max(MAX_SENSORS).optional(),
  hubs: z.array(hubSchema).max(MAX_HUBS).optional(),
  cables: z.array(cableSchema).max(MAX_CABLES).optional(),
  cableTypes: z.array(cableTypeSchema).max(MAX_CABLE_TYPES).optional(),
  cableSettings: cableSettingsSchema.optional(),
  fireAlarmDevices: z.array(placedFireAlarmDeviceSchema).max(MAX_FIRE_ALARM_DEVICES).optional(),
  fireAlarmSettings: fireAlarmSettingsSchema.optional(),
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
    hubs: project.hubs,
    cables: project.cables,
    cableTypes: project.cableTypes,
    cableSettings: project.cableSettings,
    fireAlarmDevices: project.fireAlarmDevices,
    fireAlarmSettings: project.fireAlarmSettings,
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
 * Parses untrusted project-file text. Single trust boundary for loaded JSON:
 * size cap, strict schema, image restricted to inline PNG/JPEG data URLs,
 * cameras/sensors/fire-alarm devices cross-checked and normalised against
 * `lookups` (a file missing any of `walls`/`sensors`/`fireAlarmDevices`
 * loads with none; `fireAlarmSettings` defaults when absent), cables
 * normalised against the cameras/sensors that survived
 * (`normaliseLoadedCabling`). Never throws - every failure returns `{ ok: false, error }`.
 */
export function parseProjectFile(text: string, lookups: ProjectFileLookups): ParseProjectResult {
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
      if (lookups.cameraModelIds.has(camera.modelId)) return true
      warnings.push(`Camera "${camera.id}" references unknown model "${camera.modelId}"; dropped.`)
      return false
    })

    const walls = normaliseLoadedWalls(result.data.walls ?? [], warnings)
    const sensors = normaliseLoadedSensors(result.data.sensors ?? [], lookups.sensorModelLookup, warnings)
    const fireAlarmDevices = normaliseLoadedFireAlarmDevices(result.data.fireAlarmDevices ?? [], lookups.fireAlarmModelIds, warnings)
    const project: Project = {
      image: result.data.image,
      scale: result.data.scale,
      cameras,
      walls,
      sensors,
      ...normaliseLoadedCabling(result.data, { cameras, sensors }, warnings),
      fireAlarmDevices,
      fireAlarmSettings: result.data.fireAlarmSettings ?? { ...DEFAULT_FIRE_ALARM_SETTINGS },
    }

    return { ok: true, project, warnings }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error parsing project file.' }
  }
}
