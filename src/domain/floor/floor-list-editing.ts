/**
 * Pure helpers over a `Floor[]` list: add/rename/move/remove, the default
 * name for a newly added floor, and the identity diff the store's
 * undo/redo auto-switch uses to find which floor an undo/redo touched.
 * No React/Konva/`src/catalog` imports (enforced by `no-react-konva-imports.test.ts`).
 *
 * Every function here returns the SAME array reference when the edit is a
 * no-op (unknown id, no real change, at a limit) - the store actions use
 * that reference equality to decide whether to call `set()` at all, so a
 * refused edit never creates an undo step (same convention as
 * `project-store-cabling-actions.ts`'s `patchItemById`).
 */
import { MAX_FLOORS, type Floor } from './floor-types'

/**
 * The lowest-numbered unused "Floor N" - NOT just `floors.length + 1`
 * (Low item: that could collide with an existing floor literally named
 * "Floor 2" after a delete/rename/reorder leaves the count out of step
 * with the names already in use). Names are still free text otherwise
 * (CLAUDE.md puts no uniqueness requirement on them, unlike ids) - this
 * only keeps the AUTOMATIC suggestion from duplicating one.
 */
export function defaultFloorName(floors: Floor[]): string {
  const usedNames = new Set(floors.map((floor) => floor.name))
  let n = 1
  while (usedNames.has(`Floor ${n}`)) n++
  return `Floor ${n}`
}

/** Appends `newFloor`. No-op (same array) at `MAX_FLOORS`. */
export function addFloorToList(floors: Floor[], newFloor: Floor): Floor[] {
  if (floors.length >= MAX_FLOORS) return floors
  return [...floors, newFloor]
}

/** Renames the floor with `id` to `name.trim()`. No-op when the id is unknown, the trimmed name is empty, or it equals the current name. */
export function renameFloorInList(floors: Floor[], id: string, name: string): Floor[] {
  const trimmed = name.trim()
  if (trimmed.length === 0) return floors
  const index = floors.findIndex((floor) => floor.id === id)
  if (index === -1 || floors[index].name === trimmed) return floors
  return floors.map((floor, i) => (i === index ? { ...floor, name: trimmed } : floor))
}

/** Moves the floor with `id` to `toIndex` (clamped to the list's bounds). No-op when the id is unknown or it is already at that index. */
export function moveFloorInList(floors: Floor[], id: string, toIndex: number): Floor[] {
  const fromIndex = floors.findIndex((floor) => floor.id === id)
  if (fromIndex === -1) return floors
  const clampedIndex = Math.max(0, Math.min(toIndex, floors.length - 1))
  if (clampedIndex === fromIndex) return floors
  const next = [...floors]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(clampedIndex, 0, moved)
  return next
}

/** Removes the floor with `id`. No-op (same array) when it is the last floor or the id is unknown - a project always keeps >= 1 floor. */
export function removeFloorFromList(floors: Floor[], id: string): Floor[] {
  if (floors.length <= 1 || !floors.some((floor) => floor.id === id)) return floors
  return floors.filter((floor) => floor.id !== id)
}

/**
 * "Nearest neighbour by index" after a floor at `removedIndex` is gone from
 * a list that now has `remainingCount` floors (`remainingCount` >= 1 - a
 * floor list is never empty): the floor that slides into the removed one's
 * slot, or the new last floor if it was already at the end. Shared by
 * `deleteFloor` (H2: picking the next active floor when you delete the one
 * you are looking at) and the undo/redo auto-switch's rule (iii) in
 * `project-store.ts` (the same situation, reached a different way).
 */
export function nearestFloorIndexAfterRemoval(removedIndex: number, remainingCount: number): number {
  return Math.min(Math.max(removedIndex, 0), remainingCount - 1)
}

/**
 * Identity diff for the undo/redo auto-switch: the ids of every floor whose
 * object reference changed between `before` and `after`, in floor order.
 * `null` when the lists differ in length (a floor was added/removed - a
 * structural change, not a content edit) or when a floor moved position
 * (same objects, different order - nothing to "switch to", and NOT the
 * same thing as a content edit even though a reorder also leaves `before[i]
 * !== after[i]` at some positions). Immutable updates mean an untouched
 * floor keeps its exact object reference, so a plain `===` scan is enough -
 * no deep comparison.
 */
export function findChangedFloorIds(before: Floor[], after: Floor[]): string[] | null {
  if (before.length !== after.length) return null
  const changed: string[] = []
  for (let i = 0; i < after.length; i++) {
    if (before[i] === after[i]) continue
    if (before[i].id !== after[i].id) return null // reordered, not edited
    changed.push(after[i].id)
  }
  return changed
}

/** `findChangedFloorIds`, narrowed to the single-floor-content-change case the original (phase 2/3) auto-switch rule needs. `null` for zero, two-or-more, or an unreorderable diff. */
export function findSingleChangedFloorId(before: Floor[], after: Floor[]): string | null {
  const changed = findChangedFloorIds(before, after)
  return changed?.length === 1 ? changed[0] : null
}
