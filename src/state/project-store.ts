import { create } from 'zustand'
import { temporal } from 'zundo'
import type { CableLayout } from '../domain/cable/cable-layout-types'
import { findSingleChangedFloorId } from '../domain/floor/floor-list-editing'
import type { Floor } from '../domain/floor/floor-types'
import type { FireAlarmLayout } from '../domain/project-file/project-types'
import { patchActiveFloor, type FloorContent } from './project-store-active-floor-update'
import { createCablingActions } from './project-store-cabling-actions'
import { createFireAlarmActions } from './project-store-fire-alarm-actions'
import { createFloorActions } from './project-store-floor-actions'
import { selectActiveFloor } from './project-store-floor-selectors'
import { createPlacedItemActions } from './project-store-placed-item-actions'
import { createInitialProjectState, type ProjectState, type ProjectStore } from './project-store-state-and-action-types'

export type { ProjectState, ProjectActions, ProjectStore } from './project-store-state-and-action-types'

/**
 * The project store: ordered floors, the active one, the project-wide
 * shafts/cable types/cable settings/fire-alarm settings. This is the thing
 * that gets saved to / loaded from disk and undone/redone (via zundo - see
 * the `temporal(...)` wrapper below). View-only state (pan/zoom, tool mode,
 * selection, which floor's image is decoded) lives in `editor-ui-store.ts`
 * instead, so it never pollutes the save payload or undo history.
 */

/** Routes a cabling-slice partial (`hubs`/`cables` -> the active floor, `cableTypes`/`cableSettings` -> project level) into one `ProjectState` patch, so `createCablingActions`'s single `set()` call still produces one undo step. No call ever mixes the two groups (see `project-store-cabling-actions.ts`). */
function routeCablingPartial(
  state: Pick<ProjectState, 'floors' | 'activeFloorId'>,
  partial: Partial<CableLayout>,
): Partial<ProjectState> {
  const floorPatch: Partial<FloorContent> = {}
  if (partial.hubs !== undefined) floorPatch.hubs = partial.hubs
  if (partial.cables !== undefined) floorPatch.cables = partial.cables
  const patch: Partial<ProjectState> = Object.keys(floorPatch).length > 0 ? patchActiveFloor(state, floorPatch) : {}
  if (partial.cableTypes !== undefined) patch.cableTypes = partial.cableTypes
  if (partial.cableSettings !== undefined) patch.cableSettings = partial.cableSettings
  return patch
}

/** Same routing for the fire-alarm slice: `fireAlarmDevices` -> the active floor, `fireAlarmSettings` -> project level. */
function routeFireAlarmPartial(
  state: Pick<ProjectState, 'floors' | 'activeFloorId'>,
  partial: Partial<FireAlarmLayout>,
): Partial<ProjectState> {
  const patch: Partial<ProjectState> =
    partial.fireAlarmDevices !== undefined ? patchActiveFloor(state, { fireAlarmDevices: partial.fireAlarmDevices }) : {}
  if (partial.fireAlarmSettings !== undefined) patch.fireAlarmSettings = partial.fireAlarmSettings
  return patch
}

// `replaceProject`/`resetProject` below call `useProjectStore.temporal` - a
// reference to the store this very `create()(...)` call produces. That's
// safe despite looking circular: see the long-standing comment this phase
// carried over from before the floors restructure - it's zundo's own
// documented pattern for clearing history.
export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set, get) => ({
      ...createInitialProjectState(),

      ...createFloorActions(
        (partial) => set(partial),
        () => get(),
      ),

      ...createPlacedItemActions(
        (partial) => set(patchActiveFloor(get(), partial)),
        () => selectActiveFloor(get()),
      ),

      // Thin lambdas: zundo's `set`/`get` are typed for the whole store, each slice only needs its own keys.
      ...createCablingActions(
        (partial) => set(routeCablingPartial(get(), partial)),
        () => {
          const state = get()
          const floor = selectActiveFloor(state)
          return { hubs: floor.hubs, cables: floor.cables, cableTypes: state.cableTypes, cableSettings: state.cableSettings }
        },
      ),
      ...createFireAlarmActions(
        (partial) => set(routeFireAlarmPartial(get(), partial)),
        () => ({ fireAlarmDevices: selectActiveFloor(get()).fireAlarmDevices, fireAlarmSettings: get().fireAlarmSettings }),
      ),

      replaceProject: (project) => {
        set({
          floors: project.floors,
          activeFloorId: project.floors[0].id,
          shafts: project.shafts,
          cableTypes: project.cableTypes,
          cableSettings: project.cableSettings,
          fireAlarmSettings: project.fireAlarmSettings,
        })
        useProjectStore.temporal.getState().clear()
      },

      resetProject: () => {
        set(createInitialProjectState())
        useProjectStore.temporal.getState().clear()
      },
    }),
    {
      // `floors` IS tracked whole, image included - unlike the old flat
      // single-image store, replacing a floor's plan is now an ordinary
      // undoable step (phase 2 decision j). Snapshots hold references, not
      // copies (see `project-store-floors.test.ts`'s zundo proof), so this
      // costs no extra cloning; the accepted tradeoff is that a replaced or
      // deleted floor's image data URL stays alive in memory for as long as
      // any of the `limit` history steps below can still reach it.
      // `activeFloorId` is deliberately excluded: a floor switch is not an
      // undo step. `equality` is what makes that work - without it, zundo
      // records a step for every `set()` call, changed or not, so a `set()`
      // that only touches `activeFloorId` would still add an empty step.
      partialize: (state) => ({
        floors: state.floors,
        shafts: state.shafts,
        cableTypes: state.cableTypes,
        cableSettings: state.cableSettings,
        fireAlarmSettings: state.fireAlarmSettings,
      }),
      equality: (a, b) =>
        a.floors === b.floors &&
        a.shafts === b.shafts &&
        a.cableTypes === b.cableTypes &&
        a.cableSettings === b.cableSettings &&
        a.fireAlarmSettings === b.fireAlarmSettings,
      limit: 100,
    },
  ),
)

/** Switches to the floor `before -> after` auto-switch finds changed (if exactly one did), then clamps `activeFloorId` to an existing floor - undo/redo can restore or remove floors, and `activeFloorId` itself is never part of what they restore. */
function autoSwitchAndClamp(before: Floor[]): void {
  const changedFloorId = findSingleChangedFloorId(before, useProjectStore.getState().floors)
  if (changedFloorId !== null) useProjectStore.getState().setActiveFloor(changedFloorId)

  const { floors, activeFloorId } = useProjectStore.getState()
  if (!floors.some((floor) => floor.id === activeFloorId)) {
    useProjectStore.setState({ activeFloorId: floors[0].id })
  }
}

/** Undoes one step, then auto-switches to the floor it changed and clamps `activeFloorId` - the one place every undo trigger (toolbar button, keyboard shortcut) goes through. */
export function undoProject(): void {
  const before = useProjectStore.getState().floors
  useProjectStore.temporal.getState().undo()
  autoSwitchAndClamp(before)
}

/** Redo counterpart of `undoProject`. */
export function redoProject(): void {
  const before = useProjectStore.getState().floors
  useProjectStore.temporal.getState().redo()
  autoSwitchAndClamp(before)
}
