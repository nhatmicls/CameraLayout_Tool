import { create } from 'zustand'
import { temporal } from 'zundo'
import type { CableLayout } from '../domain/cable/cable-layout-types'
import { findSingleChangedFloorId, nearestFloorIndexAfterRemoval } from '../domain/floor/floor-list-editing'
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
        // C1: activate the first floor that actually HAS an image, not always `floors[0]` -
        // tab 1 need not be the one with a plan (the schema only requires SOME floor to have one).
        const activeFloorId = project.floors.find((floor) => floor.image !== null)?.id ?? project.floors[0].id
        set({
          floors: project.floors,
          activeFloorId,
          shafts: project.shafts,
          cableTypes: project.cableTypes,
          cableSettings: project.cableSettings,
          fireAlarmSettings: project.fireAlarmSettings,
          loadSeq: get().loadSeq + 1, // M2: always changes, even when activeFloorId coincidentally does not
        })
        useProjectStore.temporal.getState().clear()
      },

      resetProject: () => {
        set({ ...createInitialProjectState(), loadSeq: get().loadSeq + 1 })
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

/**
 * H2 fix: exactly THREE rules decide whether undo/redo moves the active
 * floor - no module-level "remember where I came from" state (the old
 * approach misfired: it could jump the user off a floor they had
 * deliberately switched to, or land on the wrong floor after an
 * undo/redo/undo round-trip, since it only ever remembered the SINGLE most
 * recent `addFloor` call regardless of what happened since).
 *
 *  (i)   Exactly one floor's CONTENT changed (`findSingleChangedFloorId`):
 *        switch to it - the existing, well-tested auto-switch.
 *  (ii)  The floor list GREW during an UNDO specifically: that can only mean
 *        undoing a `deleteFloor` (redoing an `addFloor` also grows the list,
 *        but during a REDO - deliberately left alone below, since nothing
 *        was just taken away from the user to restore). Switch to the
 *        floor that reappeared.
 *  (iii) The floor the user was ACTUALLY looking at just vanished (shrink,
 *        either direction - undo of an add, or redo of a delete): move to
 *        its nearest neighbour by index, not always tab 1. If some OTHER
 *        floor vanished while a different one was active, the active floor
 *        is untouched - no stale memory needed, this is re-checked fresh
 *        every time.
 *
 * Direction-aware on purpose: `before`/`after` alone cannot distinguish
 * "undoing a delete" from "redoing an add" (both grow the list) - only the
 * caller (`undoProject`/`redoProject`) knows which one this is.
 */
function autoSwitchAndClamp(before: Floor[], direction: 'undo' | 'redo'): void {
  const after = useProjectStore.getState().floors
  const changedFloorId = findSingleChangedFloorId(before, after)
  if (changedFloorId !== null) {
    useProjectStore.getState().setActiveFloor(changedFloorId)
  } else if (after.length > before.length && direction === 'undo') {
    const reappearedId = after.find((floor) => !before.some((b) => b.id === floor.id))?.id
    if (reappearedId) useProjectStore.getState().setActiveFloor(reappearedId)
  } else if (after.length < before.length) {
    const activeFloorId = useProjectStore.getState().activeFloorId // unchanged by undo/redo itself
    if (!after.some((floor) => floor.id === activeFloorId)) {
      const vanishedIndex = before.findIndex((floor) => floor.id === activeFloorId)
      const neighbourIndex = nearestFloorIndexAfterRemoval(vanishedIndex, after.length)
      useProjectStore.getState().setActiveFloor(after[neighbourIndex].id)
    }
  }

  const { floors, activeFloorId } = useProjectStore.getState()
  if (!floors.some((floor) => floor.id === activeFloorId)) {
    useProjectStore.setState({ activeFloorId: floors[0].id })
  }
}

/** Undoes one step, then auto-switches per the three rules above and clamps `activeFloorId` - the one place every undo trigger (toolbar button, keyboard shortcut) goes through. */
export function undoProject(): void {
  const before = useProjectStore.getState().floors
  useProjectStore.temporal.getState().undo()
  autoSwitchAndClamp(before, 'undo')
}

/** Redo counterpart of `undoProject`. */
export function redoProject(): void {
  const before = useProjectStore.getState().floors
  useProjectStore.temporal.getState().redo()
  autoSwitchAndClamp(before, 'redo')
}
