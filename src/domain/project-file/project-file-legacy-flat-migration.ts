import { z } from 'zod'
import type { CableSettings, CableType } from '../cable/cable-layout-types'
import { MAX_CABLES, MAX_CABLE_TYPES, MAX_HUBS } from '../cable/cable-layout-types'
import type { FireAlarmSettings } from '../fire-alarm/fire-alarm-device-types'
import { LEGACY_FLOOR_ID, LEGACY_FLOOR_NAME } from '../floor/floor-types'
import { cableSchema, cableSettingsSchema, cableTypeSchema, hubSchema } from './project-file-cable-schema'
import { MAX_FIRE_ALARM_DEVICES, fireAlarmSettingsSchema, placedFireAlarmDeviceSchema } from './project-file-fire-alarm-schema'
import { MAX_CAMERAS, placedCameraSchema, planImageSchema, scaleCalibrationSchema, type LoadedFloor } from './project-file-floor-schema'
import { MAX_SENSORS, placedSensorSchema } from './project-file-sensor-schema'
import { MAX_WALLS, wallSchema } from './project-file-wall-schema'

/**
 * The pre-v7 flat file shape (schema versions 1-6, decision h + the plan's
 * drift addendum): one floor's data at the top level, `image` REQUIRED
 * (today's "save is refused without an image" rule). A strict superset
 * relationship holds across 1-6 exactly like before v7 - every older field
 * is a subset of the newest optional keys - so one schema reads all six
 * versions with no stepwise migrator (same rationale as the pre-multi-floor
 * `projectFileSchema`).
 */
export const legacyFlatProjectFileSchema = z.strictObject({
  app: z.literal('camera-layout-tool'),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
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

export type LegacyFlatProjectFileData = z.infer<typeof legacyFlatProjectFileSchema>

/**
 * What a legacy flat file becomes once wrapped for the shared per-floor
 * pipeline: one floor's raw data (`floorRaw`, shaped exactly like
 * `project-file-floor-schema.ts`'s `LoadedFloor`) plus the project-level
 * fields that sit outside a floor. `cableTypes`/`cableSettings` were already
 * project-wide pre-v7; `fireAlarmSettings` only became project-wide in v7 -
 * a legacy file's top-level `fireAlarmSettings` becomes the PROJECT's
 * setting (addendum), while its `fireAlarmDevices` become that one floor's.
 */
export interface WrappedLegacyFlatProject {
  floorRaw: LoadedFloor
  cableTypesRaw: CableType[] | undefined
  cableSettingsRaw: CableSettings | undefined
  fireAlarmSettingsRaw: FireAlarmSettings | undefined
}

/** `floorHeightM` is never in a pre-v7 file - `normaliseLoadedFloor` fills `DEFAULT_FLOOR_HEIGHT_M`. */
export function wrapLegacyFlatProjectAsOneFloor(raw: LegacyFlatProjectFileData): WrappedLegacyFlatProject {
  return {
    floorRaw: {
      id: LEGACY_FLOOR_ID,
      name: LEGACY_FLOOR_NAME,
      image: raw.image,
      scale: raw.scale,
      cameras: raw.cameras,
      walls: raw.walls,
      sensors: raw.sensors,
      hubs: raw.hubs,
      cables: raw.cables,
      fireAlarmDevices: raw.fireAlarmDevices,
    },
    cableTypesRaw: raw.cableTypes,
    cableSettingsRaw: raw.cableSettings,
    fireAlarmSettingsRaw: raw.fireAlarmSettings,
  }
}
