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

/** `Floor N`, N = the 1-based position the new floor would take. Not deduplicated against existing names - names are free text (CLAUDE.md puts no uniqueness requirement on them, unlike ids). */
export function defaultFloorName(floors: Floor[]): string {
  return `Floor ${floors.length + 1}`
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
 * Identity diff for the undo/redo auto-switch: returns the id of the ONE
 * floor whose object reference changed between `before` and `after`, or
 * `null` when the lists differ in length (a floor was added/removed - a
 * structural change, not a content edit), when a floor moved position
 * (same objects, different order - nothing to "switch to"), or when more
 * than one floor's content changed. Immutable updates mean an untouched
 * floor keeps its exact object reference, so a plain `===` scan is enough -
 * no deep comparison.
 */
export function findSingleChangedFloorId(before: Floor[], after: Floor[]): string | null {
  if (before.length !== after.length) return null
  let changedId: string | null = null
  for (let i = 0; i < after.length; i++) {
    if (before[i] === after[i]) continue
    if (before[i].id !== after[i].id) return null // reordered, not edited
    if (changedId !== null) return null // more than one floor changed
    changedId = after[i].id
  }
  return changedId
}
