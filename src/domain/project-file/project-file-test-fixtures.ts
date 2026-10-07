/**
 * Shared test fixtures for the v7 multi-floor project file: a tiny valid PNG
 * data URL, builders for a one-floor `Project`/`Floor`, and `onlyFloor` - a
 * drop-in replacement for the pre-v7 tests' "the whole project is one
 * floor's data" assertions, now that floor data lives under `floors[0]`.
 */
import { DEFAULT_CABLE_SETTINGS, createDefaultCableTypes } from '../cable/cable-layout-types'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../fire-alarm/fire-alarm-device-types'
import { DEFAULT_FLOOR_HEIGHT_M, LEGACY_FLOOR_ID, LEGACY_FLOOR_NAME, type Floor } from '../floor/floor-types'
import type { ParseProjectResult } from './project-file-schema'
import type { Project } from './project-types'

// Smallest possible valid PNG (1x1 transparent pixel), as a real base64 data URL.
export const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAk6WgQAAAABJRU5ErkJggg=='

/** A floor with a valid tiny image and otherwise-empty arrays; `overrides` replaces any field. Defaults its id/name to the same ones the legacy-file wrap uses, so a one-floor fixture matches what wrapping a legacy file produces. */
export function buildFloor(overrides: Partial<Floor> = {}): Floor {
  return {
    id: LEGACY_FLOOR_ID,
    name: LEGACY_FLOOR_NAME,
    floorHeightM: DEFAULT_FLOOR_HEIGHT_M,
    image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 1000, heightPx: 800, fileName: 'floor-plan.png' },
    scale: null,
    cameras: [],
    walls: [],
    sensors: [],
    hubs: [],
    cables: [],
    fireAlarmDevices: [],
    ...overrides,
  }
}

/** A one-floor v7 project (the common case for tests migrated from the pre-v7 flat shape). `floorOverrides` build the one floor; `projectOverrides` override any OTHER project-level field (`shafts`/`cableTypes`/`cableSettings`/`fireAlarmSettings`) - use `buildProjectWithFloors` for a project with more than one floor. */
export function buildProject(floorOverrides: Partial<Floor> = {}, projectOverrides: Partial<Omit<Project, 'floors'>> = {}): Project {
  return buildProjectWithFloors([buildFloor(floorOverrides)], projectOverrides)
}

/** A v7 project with an explicit `floors` array, for multi-floor tests. `projectOverrides` override any other project-level field. */
export function buildProjectWithFloors(floors: Floor[], projectOverrides: Partial<Omit<Project, 'floors'>> = {}): Project {
  return {
    floors,
    shafts: [],
    cableTypes: createDefaultCableTypes(),
    cableSettings: { ...DEFAULT_CABLE_SETTINGS },
    fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
    ...projectOverrides,
  }
}

/** Asserts a successful parse and returns its one floor - throws if the parse failed or produced more than one floor. */
export function onlyFloor(result: ParseProjectResult): Floor {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  if (result.project.floors.length !== 1) throw new Error(`expected exactly one floor, got ${result.project.floors.length}`)
  return result.project.floors[0]
}

/** Asserts a successful parse and returns the whole project - for tests that also need `shafts`/`cableTypes`/`cableSettings`/`fireAlarmSettings`. */
export function expectOkProject(result: ParseProjectResult): Project {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result.project
}

/**
 * Builds a legacy (schema versions 1-6) flat raw file object directly - for
 * back-compat tests that need a hand-shaped pre-v7 file rather than one
 * derived from a v7 `Project`. `overrides` replaces/adds any top-level key
 * (e.g. `walls`, `sensors`, `hubs`, `fireAlarmDevices`).
 */
export function buildLegacyFlatRaw(schemaVersion: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    app: 'camera-layout-tool',
    schemaVersion,
    image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 1000, heightPx: 800, fileName: 'floor-plan.png' },
    scale: null,
    cameras: [],
    ...overrides,
  }
}

/**
 * Converts a ONE-FLOOR v7 `Project` (as built by `buildProject`) into the
 * legacy flat raw shape it would have been saved as pre-v7 - every one of
 * the floor's own fields at the top level, plus the project-level fields
 * that were already flat before v7 (`cableTypes`/`cableSettings`/
 * `fireAlarmSettings`). For back-compat tests that need to assert the WHOLE
 * project round-trips through the legacy reader, not just one field.
 */
export function toLegacyFlatRaw(project: Project, schemaVersion = 6): Record<string, unknown> {
  const [floor] = project.floors
  return {
    app: 'camera-layout-tool',
    schemaVersion,
    image: floor.image,
    scale: floor.scale,
    cameras: floor.cameras,
    walls: floor.walls,
    sensors: floor.sensors,
    hubs: floor.hubs,
    cables: floor.cables,
    cableTypes: project.cableTypes,
    cableSettings: project.cableSettings,
    fireAlarmDevices: floor.fireAlarmDevices,
    fireAlarmSettings: project.fireAlarmSettings,
  }
}
