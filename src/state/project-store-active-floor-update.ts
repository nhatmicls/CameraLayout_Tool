/**
 * Write helpers that patch one floor inside `ProjectState.floors` by
 * reference, immutably - every placed-item/cabling/fire-alarm action goes
 * through one of these two so an untouched floor always keeps its exact
 * object identity (zundo's undo history, and `findSingleChangedFloorId`,
 * both rely on that).
 */
import { pruneInvalidCrossFloorLinks } from '../domain/cable/cross-floor-hub-link-integrity'
import { clearStaleExitChoices } from '../domain/cable/shaft-cable-exit-cascade'
import { pruneShafts } from '../domain/cable/shaft-integrity'
import type { Shaft } from '../domain/cable/cable-layout-types'
import type { Floor } from '../domain/floor/floor-types'
import { selectActiveFloor } from './project-store-floor-selectors'

/** The floor fields an action patches - everything except `id`/`name` (edited only via the floor-list actions). */
export type FloorContent = Omit<Floor, 'id' | 'name'>

/**
 * A patch touching `hubs` (hub add/update/delete) or `image` (`setImage`,
 * which also clears `hubs`) can invalidate a link/trunk on ANY floor - the
 * partner side of a deleted hub lives elsewhere - or leave a shaft with no
 * markers anywhere, or a cable's `exitFloorId` stale (its exit just
 * vanished). Run the one prune/cascade rule set after every such patch, in
 * the SAME `set()` as the cause (one undo step). A patch touching neither
 * key cannot affect any of this, so every other write (camera drag, wall
 * edit, ...) skips the extra pass entirely. Exported so
 * `project-store-floor-actions.ts`'s `moveFloor`/`deleteFloor` (which don't
 * go through `patchActiveFloor`/`patchFloorById`) can run the SAME pass.
 *
 * H3 fix (phase 6 review): shafts/markers are pruned FIRST, THEN cross-floor
 * link/trunk integrity, THEN stale exit choices - same order, and the same
 * reasoning, as the loader's own three-pass pipeline (`project-file-schema.ts`).
 */
export function pruneCrossFloorAndShaftState(floors: Floor[], shafts: Shaft[]): { floors: Floor[]; shafts: Shaft[] } {
  const { floors: shaftPrunedFloors, shafts: prunedShafts } = pruneShafts(floors, shafts)
  const linked = pruneInvalidCrossFloorLinks(shaftPrunedFloors, prunedShafts.map((shaft) => shaft.id))
  return { floors: clearStaleExitChoices(linked), shafts: prunedShafts }
}

function pruneIfCablingTouched(patch: Partial<FloorContent>, floors: Floor[], shafts: Shaft[]): { floors: Floor[]; shafts: Shaft[] } {
  if (patch.hubs === undefined && patch.image === undefined) return { floors, shafts }
  return pruneCrossFloorAndShaftState(floors, shafts)
}

/**
 * Patches the ACTIVE floor. Every other floor keeps its exact reference.
 * Resolves "the active floor" via `selectActiveFloor` - the SAME fallback
 * (`floors[0]` when `activeFloorId` matches nothing) that every reader uses.
 * Without that shared resolution, a dangling `activeFloorId` made this
 * silently patch nothing (no `id` matched) while still returning a brand
 * new `floors` array - an empty-looking but still-recorded undo step that
 * quietly dropped the caller's edit.
 */
export function patchActiveFloor(
  state: { floors: Floor[]; activeFloorId: string; shafts: Shaft[] },
  patch: Partial<FloorContent>,
): { floors: Floor[]; shafts: Shaft[] } {
  const activeId = selectActiveFloor(state).id
  const patched = state.floors.map((floor) => (floor.id === activeId ? { ...floor, ...patch } : floor))
  return pruneIfCablingTouched(patch, patched, state.shafts)
}

/** Patches the floor with `floorId`. Returns the SAME `floors`/`shafts` when that id is unknown. */
export function patchFloorById(
  state: { floors: Floor[]; shafts: Shaft[] },
  floorId: string,
  patch: Partial<FloorContent>,
): { floors: Floor[]; shafts: Shaft[] } {
  const index = state.floors.findIndex((floor) => floor.id === floorId)
  if (index === -1) return { floors: state.floors, shafts: state.shafts }
  const patched = state.floors.map((floor, i) => (i === index ? { ...floor, ...patch } : floor))
  return pruneIfCablingTouched(patch, patched, state.shafts)
}
