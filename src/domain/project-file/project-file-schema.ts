import { z } from 'zod'
import { DEFAULT_CABLE_SETTINGS, MAX_CABLE_TYPES, type CableSettings, type CableType, type Shaft } from '../cable/cable-layout-types'
import { DEFAULT_FIRE_ALARM_SETTINGS, type FireAlarmSettings } from '../fire-alarm/fire-alarm-device-types'
import type { Project } from './project-types'
import { cableSettingsSchema, cableTypeSchema, normaliseLoadedCableTypes, shaftsArraySchema } from './project-file-cable-schema'
import { fireAlarmSettingsSchema } from './project-file-fire-alarm-schema'
import { MAX_PROJECT_TEXT_LENGTH_BYTES, floorsArraySchema, normaliseLoadedFloor, type FloorNormalisationLookups, type LoadedFloor } from './project-file-floor-schema'
import { legacyFlatProjectFileSchema, wrapLegacyFlatProjectAsOneFloor } from './project-file-legacy-flat-migration'
import type { SensorModelLookup } from './project-file-sensor-schema'

export { MAX_WALLS, WALLS_CROSS_WARNING } from './project-file-wall-schema'
export { MAX_SENSORS } from './project-file-sensor-schema'
export type { SensorModelLookup, SensorModelLookupEntry } from './project-file-sensor-schema'

/**
 * Version written to saved files. Schema v7 (this phase) made the project
 * multi-floor: `floors[]` + project-wide `shafts[]`/`cableTypes`/
 * `cableSettings`/`fireAlarmSettings`, replacing the flat top-level
 * image/cameras/.../fireAlarmDevices shape versions 1-6 used. The reader
 * still accepts 1-6 (`legacyFlatProjectFileSchema`, wrapped into one floor -
 * `project-file-legacy-flat-migration.ts`); the writer always emits 7, even
 * for a single-floor project (one writer path) - a v7 file will not open in
 * a pre-multi-floor build.
 */
export const PROJECT_SCHEMA_VERSION = 7 as const

/** What the file parser needs to know per model family, so callers (file I/O, tests) pass one object instead of a positional tail that grows with every new device family. */
export interface ProjectFileLookups {
  cameraModelIds: ReadonlySet<string>
  sensorModelLookup: SensorModelLookup
  fireAlarmModelIds: ReadonlySet<string>
}

const projectFileV7Schema = z.strictObject({
  app: z.literal('camera-layout-tool'),
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  floors: floorsArraySchema,
  shafts: shaftsArraySchema.optional(),
  cableTypes: z.array(cableTypeSchema).max(MAX_CABLE_TYPES).optional(),
  cableSettings: cableSettingsSchema.optional(),
  fireAlarmSettings: fireAlarmSettingsSchema.optional(),
})

/** Serialises a project to the on-disk v7 JSON shape (adds the `app`/`schemaVersion` envelope). */
export function serializeProject(project: Project): string {
  return JSON.stringify({
    app: 'camera-layout-tool',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    floors: project.floors,
    shafts: project.shafts,
    cableTypes: project.cableTypes,
    cableSettings: project.cableSettings,
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

/** `raw.schemaVersion === 7` picks the v7 schema; anything else (including non-numbers/missing) falls through to the legacy schema, so an unknown version fails there exactly as it always has. */
function isV7Envelope(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'schemaVersion' in raw && (raw as { schemaVersion: unknown }).schemaVersion === PROJECT_SCHEMA_VERSION
}

/**
 * Parses untrusted project-file text. Single trust boundary for loaded JSON:
 * size cap, strict schema (v7's `floors[]` shape, or the legacy 1-6 flat
 * shape wrapped into one floor), image restricted to inline PNG/JPEG data
 * URLs, cameras/sensors/fire-alarm devices cross-checked and normalised
 * against `lookups` PER FLOOR, cable types normalised ONCE project-wide
 * (`normaliseLoadedCableTypes`) before any floor's hubs/cables are checked
 * against them. A floor's warnings are prefixed `"<floor name>: "` only
 * when the file has more than one floor. Never throws - every failure
 * returns `{ ok: false, error }`.
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

    let floorsRaw: LoadedFloor[]
    let shaftsRaw: Shaft[]
    let cableTypesRaw: CableType[] | undefined
    let cableSettingsRaw: CableSettings | undefined
    let fireAlarmSettingsRaw: FireAlarmSettings | undefined

    if (isV7Envelope(raw)) {
      const result = projectFileV7Schema.safeParse(raw)
      if (!result.success) return { ok: false, error: `Invalid project file: ${formatZodError(result.error)}` }
      floorsRaw = result.data.floors
      shaftsRaw = result.data.shafts ?? []
      cableTypesRaw = result.data.cableTypes
      cableSettingsRaw = result.data.cableSettings
      fireAlarmSettingsRaw = result.data.fireAlarmSettings
    } else {
      const result = legacyFlatProjectFileSchema.safeParse(raw)
      if (!result.success) return { ok: false, error: `Invalid project file: ${formatZodError(result.error)}` }
      const wrapped = wrapLegacyFlatProjectAsOneFloor(result.data)
      floorsRaw = [wrapped.floorRaw]
      shaftsRaw = []
      cableTypesRaw = wrapped.cableTypesRaw
      cableSettingsRaw = wrapped.cableSettingsRaw
      fireAlarmSettingsRaw = wrapped.fireAlarmSettingsRaw
    }

    // Cable-TYPE warnings are collected separately (not pushed into `warnings` yet) so they can be
    // spliced into the pre-v7 single-floor order below, rather than landing before every floor's
    // own camera/wall/sensor/fire-alarm warnings just because types are computed first.
    const cableTypeWarnings: string[] = []
    const cableTypes = normaliseLoadedCableTypes({ cableTypes: cableTypesRaw }, cableTypeWarnings)
    const floorLookups: FloorNormalisationLookups = {
      cameraModelIds: lookups.cameraModelIds,
      sensorModelLookup: lookups.sensorModelLookup,
      fireAlarmModelIds: lookups.fireAlarmModelIds,
      cableTypes,
    }
    const multiFloor = floorsRaw.length > 1
    const warnings: string[] = []
    const floors = floorsRaw.map((floorRaw, index) => {
      const { floor, nonCablingWarnings, cablingWarnings } = normaliseLoadedFloor(floorRaw, floorLookups)
      const prefix = (list: string[]) => (multiFloor ? list.map((w) => `${floor.name}: ${w}`) : list)
      warnings.push(...prefix(nonCablingWarnings))
      // Project-wide, so emitted once (never per-floor-prefixed): spliced right after floor 0's own
      // non-cabling warnings and before any floor's hub/cable warnings - the same position the pre-v7
      // single `normaliseLoadedCabling` call used to emit them in, for a single-floor file.
      if (index === 0) warnings.push(...cableTypeWarnings)
      warnings.push(...prefix(cablingWarnings))
      return floor
    })

    const project: Project = {
      floors,
      shafts: shaftsRaw,
      cableTypes,
      cableSettings: cableSettingsRaw ?? { ...DEFAULT_CABLE_SETTINGS },
      fireAlarmSettings: fireAlarmSettingsRaw ?? { ...DEFAULT_FIRE_ALARM_SETTINGS },
    }

    return { ok: true, project, warnings }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error parsing project file.' }
  }
}
