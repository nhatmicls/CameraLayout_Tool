import { z } from 'zod'
import { DEFAULT_CABLE_SETTINGS, MAX_CABLE_TYPES, type CableSettings, type CableType, type Shaft } from '../cable/cable-layout-types'
import { DEFAULT_FIRE_ALARM_SETTINGS, type FireAlarmSettings } from '../fire-alarm/fire-alarm-device-types'
import type { Project } from './project-types'
import { cableSettingsSchema, cableTypeSchema, normaliseLoadedCableTypes, shaftsArraySchema } from './project-file-cable-schema'
import { fireAlarmSettingsSchema } from './project-file-fire-alarm-schema'
import { pruneInvalidCrossFloorLinks } from '../cable/cross-floor-hub-link-integrity'
import { clearStaleExitChoices } from '../cable/shaft-cable-exit-cascade'
import { pruneShafts } from '../cable/shaft-integrity'
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
 * `project-file-legacy-flat-migration.ts`); a v7 file will not open in a
 * pre-multi-floor build.
 *
 * Schema v8 keeps the v7 shape and adds one thing: a cable's `device` may be
 * `{ kind: 'fire-alarm', id }`. The bump exists only so a build from before
 * that change refuses the file by its version number. The reader accepts 7
 * and 8 through the same schema; the writer always emits 8, even for a
 * single-floor project (one writer path).
 */
export const PROJECT_SCHEMA_VERSION = 8 as const
/** Versions that share the `floors[]` shape (see above); everything lower is the legacy flat shape. */
const FLOORS_SHAPE_SCHEMA_VERSIONS: readonly unknown[] = [7, PROJECT_SCHEMA_VERSION]

/** What the file parser needs to know per model family, so callers (file I/O, tests) pass one object instead of a positional tail that grows with every new device family. */
export interface ProjectFileLookups {
  cameraModelIds: ReadonlySet<string>
  sensorModelLookup: SensorModelLookup
  fireAlarmModelIds: ReadonlySet<string>
}

const projectFileFloorsShapeSchema = z.strictObject({
  app: z.literal('camera-layout-tool'),
  schemaVersion: z.union([z.literal(7), z.literal(PROJECT_SCHEMA_VERSION)]),
  floors: floorsArraySchema,
  shafts: shaftsArraySchema.optional(),
  cableTypes: z.array(cableTypeSchema).max(MAX_CABLE_TYPES).optional(),
  cableSettings: cableSettingsSchema.optional(),
  fireAlarmSettings: fireAlarmSettingsSchema.optional(),
})

/** Serialises a project to the on-disk v8 JSON shape (adds the `app`/`schemaVersion` envelope). */
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

/** `raw.schemaVersion` 7 or 8 picks the `floors[]` schema; anything else (including non-numbers/missing) falls through to the legacy schema, so an unknown version fails there exactly as it always has. */
function isFloorsShapeEnvelope(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'schemaVersion' in raw &&
    FLOORS_SHAPE_SCHEMA_VERSIONS.includes((raw as { schemaVersion: unknown }).schemaVersion)
  )
}

/**
 * Parses untrusted project-file text. Single trust boundary for loaded JSON:
 * size cap, strict schema (the v7 / v8 `floors[]` shape, or the legacy 1-6 flat
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

    if (isFloorsShapeEnvelope(raw)) {
      const result = projectFileFloorsShapeSchema.safeParse(raw)
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
    // Parsed once, before any floor - D3 (phase 6 review): a shaft-shape/identity check needs only
    // this id set, never the other floors, so it can run PER FLOOR inside `normaliseLoadedFloorCabling`,
    // before that floor's own cable-ref check (its cables are then reported by the ordinary
    // "unknown hub" warning instead of silently dangling).
    const shaftIds = new Set(shaftsRaw.map((shaft) => shaft.id))
    const floorLookups: FloorNormalisationLookups = {
      cameraModelIds: lookups.cameraModelIds,
      sensorModelLookup: lookups.sensorModelLookup,
      fireAlarmModelIds: lookups.fireAlarmModelIds,
      cableTypes,
      shaftIds,
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

    // H3 fix (phase 6 review): shafts/markers are pruned FIRST (the per-floor pre-pass above
    // already handled unknown shaftId/shape issues; this also drops a now-markerless `shafts[]`
    // entry), THEN cross-floor link/trunk integrity, THEN stale exit choices. Reversing this order
    // would let `pruneInvalidCrossFloorLinks` validate a trunk against a shaft marker that this
    // pass is about to remove anyway - a hole closed independently by D1 (a trunk can never target
    // a shaft marker at all), but kept in this order too as defence in depth. Hub ids are unique
    // project-wide in practice, so none of these three passes' warnings are floor-prefixed.
    const shaftWarnings: string[] = []
    const { floors: shaftPrunedFloors, shafts: prunedShafts } = pruneShafts(floors, shaftsRaw, shaftWarnings)
    warnings.push(...shaftWarnings)

    const linkWarnings: string[] = []
    // M5 fix: the prune's own warning text labels a shaft marker "T{n}" - needs the PROJECT shaft
    // order (`prunedShafts`, the authoritative post-prune list), not a per-floor count.
    const linkedFloors = pruneInvalidCrossFloorLinks(shaftPrunedFloors, prunedShafts.map((shaft) => shaft.id), linkWarnings)
    warnings.push(...linkWarnings)

    const exitWarnings: string[] = []
    const prunedFloors = clearStaleExitChoices(linkedFloors, exitWarnings)
    warnings.push(...exitWarnings)

    const project: Project = {
      floors: prunedFloors,
      shafts: prunedShafts,
      cableTypes,
      cableSettings: cableSettingsRaw ?? { ...DEFAULT_CABLE_SETTINGS },
      fireAlarmSettings: fireAlarmSettingsRaw ?? { ...DEFAULT_FIRE_ALARM_SETTINGS },
    }

    return { ok: true, project, warnings }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error parsing project file.' }
  }
}
