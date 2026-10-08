import { findChangedFloorIds, nearestFloorIndexAfterRemoval } from '../domain/floor/floor-list-editing'
import type { Floor } from '../domain/floor/floor-types'
import { useProjectStore } from './project-store'

/**
 * `undoProject`/`redoProject` - the one place every undo/redo trigger
 * (toolbar button, keyboard shortcut) goes through - plus the H2 (+ item 6)
 * auto-switch rule they both need. Split out of `project-store.ts` to keep
 * that file under 200 lines; re-exported from there so no importer needs
 * to change.
 *
 * H2 fix (+ item 6 addition): FOUR rules decide whether undo/redo moves the
 * active floor - no module-level "remember where I came from" state (the
 * old approach misfired: it could jump the user off a floor they had
 * deliberately switched to, or land on the wrong floor after an
 * undo/redo/undo round-trip, since it only ever remembered the SINGLE most
 * recent `addFloor` call regardless of what happened since).
 *
 *  (i)   Exactly ONE floor's CONTENT changed (`findChangedFloorIds`): switch
 *        to it - the existing, well-tested auto-switch.
 *  (ii)  TWO OR MORE floors' content changed (item 6: a riser/drop link,
 *        trunk, or "Create paired point" edit always touches the hub's own
 *        floor AND its partner's - exactly two; phase 6: creating or
 *        deleting a shaft touches EVERY floor that gets/loses a marker,
 *        which can be many more than two): if the active floor is ANY of
 *        the changed ones, stay - the user is already looking at one side
 *        of the edit. Otherwise switch to the LOWEST-index changed floor
 *        (an arbitrary but deterministic choice among several equally
 *        relevant floors).
 *  (iii) The floor list GREW during an UNDO specifically: that can only mean
 *        undoing a `deleteFloor` (redoing an `addFloor` also grows the list,
 *        but during a REDO - deliberately left alone below, since nothing
 *        was just taken away from the user to restore). Switch to the
 *        floor that reappeared.
 *  (iv)  The floor the user was ACTUALLY looking at just vanished (shrink,
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
  const changed = findChangedFloorIds(before, after) // null when lengths differ or it was a pure reorder

  if (changed?.length === 1) {
    useProjectStore.getState().setActiveFloor(changed[0])
  } else if (changed && changed.length >= 2) {
    const activeFloorId = useProjectStore.getState().activeFloorId
    if (!changed.includes(activeFloorId)) {
      const lowestIndex = Math.min(...changed.map((id) => after.findIndex((floor) => floor.id === id)))
      useProjectStore.getState().setActiveFloor(after[lowestIndex].id)
    }
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
