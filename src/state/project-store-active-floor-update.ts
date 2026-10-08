/**
 * Write helpers that patch one floor inside `ProjectState.floors` by
 * reference, immutably - every placed-item/cabling/fire-alarm action goes
 * through one of these two so an untouched floor always keeps its exact
 * object identity (zundo's undo history, and `findSingleChangedFloorId`,
 * both rely on that).
 */
import { pruneInvalidCrossFloorLinks } from '../domain/cable/cross-floor-hub-link-integrity'
import type { Floor } from '../domain/floor/floor-types'
import { selectActiveFloor } from './project-store-floor-selectors'

/** The floor fields an action patches - everything except `id`/`name` (edited only via the floor-list actions). */
export type FloorContent = Omit<Floor, 'id' | 'name'>

/**
 * A patch touching `hubs` (hub add/update/delete) or `image` (`setImage`,
 * which also clears `hubs`) can invalidate a link/trunk on ANY floor - the
 * partner side of a deleted hub lives elsewhere. Run the one prune rule set
 * after every such patch, in the SAME `set()` as the cause (one undo step).
 * A patch touching neither key cannot affect a link, so every other write
 * (camera drag, wall edit, ...) skips the extra pass entirely.
 */
function pruneIfCablingTouched(patch: Partial<FloorContent>, floors: Floor[]): Floor[] {
  if (patch.hubs === undefined && patch.image === undefined) return floors
  return pruneInvalidCrossFloorLinks(floors)
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
  state: { floors: Floor[]; activeFloorId: string },
  patch: Partial<FloorContent>,
): Pick<{ floors: Floor[] }, 'floors'> {
  const activeId = selectActiveFloor(state).id
  const patched = state.floors.map((floor) => (floor.id === activeId ? { ...floor, ...patch } : floor))
  return { floors: pruneIfCablingTouched(patch, patched) }
}

/** Patches the floor with `floorId`. Returns the SAME `floors` array when that id is unknown. */
export function patchFloorById(
  state: { floors: Floor[] },
  floorId: string,
  patch: Partial<FloorContent>,
): Pick<{ floors: Floor[] }, 'floors'> {
  const index = state.floors.findIndex((floor) => floor.id === floorId)
  if (index === -1) return { floors: state.floors }
  const patched = state.floors.map((floor, i) => (i === index ? { ...floor, ...patch } : floor))
  return { floors: pruneIfCablingTouched(patch, patched) }
}
