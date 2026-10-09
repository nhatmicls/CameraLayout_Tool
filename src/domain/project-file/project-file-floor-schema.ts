import { z } from 'zod'
import {
  MOUNT_HEIGHT_MAX_M,
  MOUNT_HEIGHT_MIN_M,
  TILT_MAX_DEG,
  TILT_MIN_DEG,
} from '../camera/mounted-camera-ground-coverage-calculator'
import { MAX_CABLES, MAX_HUBS, type CableType } from '../cable/cable-layout-types'
import { DEFAULT_FLOOR_HEIGHT_M, FLOOR_HEIGHT_BOUNDS, FLOOR_NAME_MAX_LENGTH, MAX_FLOORS, type Floor } from '../floor/floor-types'
import { MAX_FIRE_ALARM_DEVICES, normaliseLoadedFireAlarmDevices, placedFireAlarmDeviceSchema } from './project-file-fire-alarm-schema'
import { hubSchema, cableSchema, normaliseLoadedFloorCabling } from './project-file-cable-schema'
import { MAX_SENSORS, normaliseLoadedSensors, placedSensorSchema, type SensorModelLookup } from './project-file-sensor-schema'
import { MAX_WALLS, normaliseLoadedWalls, wallSchema } from './project-file-wall-schema'

/**
 * Per-floor image / scale / camera schemas + the floor schema itself (schema
 * v7). Split out of `project-file-schema.ts` to keep that file under 200
 * lines - mirrors the existing wall/sensor/cable/fire-alarm schema files.
 * `planImageSchema`/`scaleCalibrationSchema`/`placedCameraSchema` were moved
 * here unchanged from `project-file-schema.ts` (pre-v7 they lived at the
 * project's top level; now they live on each floor).
 */

/** Mirrors `serializeCsv`'s input cap intent: generous for a floor-plan PNG, small enough to reject garbage quickly. Defined here (needed by `planImageSchema`'s data-url length cap) and imported by `project-file-schema.ts` for its own top-level text-length check, to avoid a value-level circular import between the two files. */
export const MAX_PROJECT_TEXT_LENGTH_BYTES = 80 * 1024 * 1024 // 80 MB

const DATA_URL_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/

export const planImageSchema = z.strictObject({
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

export const scaleCalibrationSchema = z.strictObject({
  planPxPerMeter: z.number().finite().gt(0),
  refLine: refLineSchema,
  refLengthM: z.number().finite().gt(0),
})

export const placedCameraSchema = z
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

export const MAX_CAMERAS = 500

function bounded(bounds: { min: number; max: number }) {
  return z.number().finite().gte(bounds.min).lte(bounds.max)
}

const floorFieldsEmptyWhenImageless = (floor: { image: unknown; scale: unknown; cameras: unknown[]; walls?: unknown[]; sensors?: unknown[]; hubs?: unknown[]; cables?: unknown[]; fireAlarmDevices?: unknown[] }) =>
  floor.image !== null ||
  (floor.scale === null &&
    floor.cameras.length === 0 &&
    (floor.walls ?? []).length === 0 &&
    (floor.sensors ?? []).length === 0 &&
    (floor.hubs ?? []).length === 0 &&
    (floor.cables ?? []).length === 0 &&
    (floor.fireAlarmDevices ?? []).length === 0)

/** One floor's on-disk shape (schema v7). `floorHeightM` optional - a legacy-wrapped or hand-written file without it gets `DEFAULT_FLOOR_HEIGHT_M` at normalisation. */
export const floorSchema = z
  .strictObject({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(FLOOR_NAME_MAX_LENGTH),
    floorHeightM: bounded(FLOOR_HEIGHT_BOUNDS).optional(),
    image: planImageSchema.nullable(),
    scale: scaleCalibrationSchema.nullable(),
    cameras: z.array(placedCameraSchema).max(MAX_CAMERAS),
    walls: z.array(wallSchema).max(MAX_WALLS).optional(),
    sensors: z.array(placedSensorSchema).max(MAX_SENSORS).optional(),
    hubs: z.array(hubSchema).max(MAX_HUBS).optional(),
    cables: z.array(cableSchema).max(MAX_CABLES).optional(),
    fireAlarmDevices: z.array(placedFireAlarmDeviceSchema).max(MAX_FIRE_ALARM_DEVICES).optional(),
  })
  .refine(floorFieldsEmptyWhenImageless, {
    message: 'a floor with no image must have no scale, cameras, walls, sensors, hubs, cables or fire-alarm devices',
    path: ['image'],
  })

export type LoadedFloor = z.infer<typeof floorSchema>

/** The whole `floors` array: 1..`MAX_FLOORS`, unique ids, and at least one floor with an image (nothing to open otherwise). */
export const floorsArraySchema = z
  .array(floorSchema)
  .min(1)
  .max(MAX_FLOORS)
  .refine((floors) => new Set(floors.map((floor) => floor.id)).size === floors.length, {
    message: 'floor ids must be unique',
  })
  .refine((floors) => floors.some((floor) => floor.image !== null), {
    message: 'at least one floor must have an image',
  })

export interface FloorNormalisationLookups {
  cameraModelIds: ReadonlySet<string>
  sensorModelLookup: SensorModelLookup
  fireAlarmModelIds: ReadonlySet<string>
  /** The project-wide deduped cable types (`normaliseLoadedCableTypes`, called once for the whole file). */
  cableTypes: readonly CableType[]
  /** The project-wide `shafts[]` id set, parsed once before any floor (D3, phase 6 review). */
  shaftIds: ReadonlySet<string>
}

/**
 * Normalises one floor: filters cameras by known model id, then delegates to
 * the per-domain normalisers (walls, sensors, fire-alarm devices, then
 * hubs/cables) exactly as the pre-v7 single-floor pipeline did. Warnings come
 * back as two separate lists - `nonCablingWarnings` (camera/wall/sensor/
 * fire-alarm, in that order) and `cablingWarnings` (hub/cable) - so the
 * caller (`project-file-schema.ts`) can splice the project-wide cable-TYPE
 * warnings between them, exactly where the pre-v7 single `normaliseLoadedCabling`
 * call used to emit them (type dedupe, then hub dedupe, then cable checks),
 * keeping a single-floor file's warning order byte-identical to before.
 * Both lists are unprefixed - the caller prefixes them with the floor name
 * only when the file has more than one floor.
 */
export function normaliseLoadedFloor(
  raw: LoadedFloor,
  lookups: FloorNormalisationLookups,
): { floor: Floor; nonCablingWarnings: string[]; cablingWarnings: string[] } {
  const nonCablingWarnings: string[] = []

  const cameras = raw.cameras.filter((camera) => {
    if (lookups.cameraModelIds.has(camera.modelId)) return true
    nonCablingWarnings.push(`Camera "${camera.id}" references unknown model "${camera.modelId}"; dropped.`)
    return false
  })
  const walls = normaliseLoadedWalls(raw.walls ?? [], nonCablingWarnings)
  const sensors = normaliseLoadedSensors(raw.sensors ?? [], lookups.sensorModelLookup, nonCablingWarnings)
  const fireAlarmDevices = normaliseLoadedFireAlarmDevices(raw.fireAlarmDevices ?? [], lookups.fireAlarmModelIds, nonCablingWarnings)

  const cablingWarnings: string[] = []
  const { hubs, cables } = normaliseLoadedFloorCabling(raw, lookups.cableTypes, lookups.shaftIds, { cameras, sensors, fireAlarmDevices }, cablingWarnings)

  const floor: Floor = {
    id: raw.id,
    name: raw.name,
    floorHeightM: raw.floorHeightM ?? DEFAULT_FLOOR_HEIGHT_M,
    image: raw.image,
    scale: raw.scale,
    cameras,
    walls,
    sensors,
    hubs,
    cables,
    fireAlarmDevices,
  }
  return { floor, nonCablingWarnings, cablingWarnings }
}
