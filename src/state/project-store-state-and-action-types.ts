import { createEmptyCableLayout } from '../domain/cable/cable-layout-types'
import type { CableType, CableSettings, Shaft } from '../domain/cable/cable-layout-types'
import { defaultFloorName } from '../domain/floor/floor-list-editing'
import { createEmptyFloor, type Floor } from '../domain/floor/floor-types'
import { DEFAULT_FIRE_ALARM_SETTINGS, type FireAlarmSettings } from '../domain/fire-alarm/fire-alarm-device-types'
import type { Project } from '../domain/project-file/project-types'
import type { CablingActions } from './project-store-cabling-actions'
import type { CrossFloorLinkActions } from './project-store-cross-floor-link-actions'
import type { FireAlarmActions } from './project-store-fire-alarm-actions'
import type { FloorListActions } from './project-store-floor-actions'
import type { PlacedItemActions } from './project-store-placed-item-actions'
import type { ShaftActions } from './project-store-shaft-actions'

/**
 * `ProjectState`/`ProjectActions`/`ProjectStore` and the initial-state
 * factory, extracted out of `project-store.ts` to keep that file under 200
 * lines.
 *
 * Schema v7 (multi-floor, see CLAUDE.md + the plan's drift addendum): the
 * store holds `floors[]` + `activeFloorId` instead of a flat
 * image/scale/cameras/walls/sensors/hubs/cables/fireAlarmDevices. Every
 * placed-item/cabling/fire-alarm-device action now acts on the ACTIVE
 * floor (see `project-store-floor-selectors.ts` for reads and
 * `project-store-active-floor-update.ts` for writes).
 * `cableTypes`/`cableSettings`/`fireAlarmSettings` stay project-level - one
 * procurement convention and one coverage-mode setting for the whole
 * building, not per floor.
 */
export interface ProjectState {
  floors: Floor[]
  /** The floor every placed-item/cabling/fire-alarm action reads and writes. Always an id present in `floors` (every mutation clamps it) - not tracked by undo/redo (see `project-store.ts`'s `equality` option) and not part of the saved project file. */
  activeFloorId: string
  shafts: Shaft[]
  cableTypes: CableType[]
  cableSettings: CableSettings
  fireAlarmSettings: FireAlarmSettings
  /**
   * M2 fix: bumped by `replaceProject`/`resetProject` ONLY. Two legacy
   * (pre-v7) files both wrap their one floor under the SAME id
   * (`LEGACY_FLOOR_ID`), so opening one right after the other can leave
   * `activeFloorId` unchanged across the load - the plain "did
   * `activeFloorId` change" check `project-store-to-editor-ui-sync.ts` used
   * for selection/tool reset then misses it entirely. This counter changes
   * on every load regardless, and also drives a forced stage remount (see
   * `editor-ui-store`'s `projectLoadEpoch`). Not tracked by undo/redo, not
   * part of the saved project file - a view-reset signal only.
   */
  loadSeq: number
}

export interface ProjectActions extends FloorListActions, PlacedItemActions, CablingActions, FireAlarmActions, CrossFloorLinkActions, ShaftActions {
  /** Replaces the whole project (used when loading a project file). Sets the active floor to `project.floors[0]` (tab 1 = lowest floor) and clears undo history. */
  replaceProject: (project: Project) => void
  /** Clears back to the empty-project state: one empty floor, no shafts, default cable types/settings/fire-alarm settings. Clears undo history. */
  resetProject: () => void
}

export type ProjectStore = ProjectState & ProjectActions

/** A function, not a constant: every reset needs fresh arrays/objects (and a fresh floor id). */
export const createInitialProjectState = (): ProjectState => {
  const floor = createEmptyFloor(crypto.randomUUID(), defaultFloorName([]))
  const { cableTypes, cableSettings } = createEmptyCableLayout()
  return {
    floors: [floor],
    activeFloorId: floor.id,
    shafts: [],
    cableTypes,
    cableSettings,
    fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
    loadSeq: 0,
  }
}
