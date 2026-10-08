import type { Shaft } from '../domain/cable/cable-layout-types'
import {
  addFloorToList,
  defaultFloorName,
  moveFloorInList,
  nearestFloorIndexAfterRemoval,
  removeFloorFromList,
  renameFloorInList,
} from '../domain/floor/floor-list-editing'
import { createEmptyFloor, type Floor } from '../domain/floor/floor-types'
import type { PlanImage } from '../domain/project-file/project-types'
import { patchActiveFloor, pruneCrossFloorAndShaftState } from './project-store-active-floor-update'

/**
 * The floor-list slice of the project store: switching the active floor,
 * add/rename/move/delete, the per-floor height, and `setImage` (clears the
 * active floor's placed items as ONE ordinary undo step - never clears
 * history; see the plan's drift addendum). Split out of `project-store.ts`
 * to keep that file under 200 lines, mirroring the cabling/fire-alarm
 * slices' adapter-lambda pattern.
 */
export interface FloorListState {
  floors: Floor[]
  activeFloorId: string
  shafts: Shaft[]
}

export interface FloorListActions {
  /** No-op if `id` is already active or unknown. */
  setActiveFloor: (id: string) => void
  /** No-op at `MAX_FLOORS`. The new floor becomes active. `name` defaults to "Floor N". */
  addFloor: (name?: string) => void
  /** Trims `name`. No-op if `id` is unknown or the trimmed name is empty/unchanged. */
  renameFloor: (id: string, name: string) => void
  /** `toIndex` is clamped to the list's bounds. No-op if `id` is unknown or it is already there. */
  moveFloor: (id: string, toIndex: number) => void
  /** No-op on the last remaining floor or an unknown id. Deleting the active floor reassigns `activeFloorId` to its nearest neighbour by index (H2) - not always the first floor. */
  deleteFloor: (id: string) => void
  /** No-op if `id` is unknown or the value is unchanged. */
  setFloorHeight: (id: string, floorHeightM: number) => void
  /** Sets a newly loaded floor-plan image on the ACTIVE floor. Always clears that floor's cameras, walls, sensors, hubs, cables and fire-alarm devices + scale (meaningless against a different plan) as one ordinary undo step - first image or replacement alike. Never clears undo history: other floors, and this floor's own earlier steps, stay reachable. Project-level `cableTypes`/`cableSettings`/`fireAlarmSettings` are untouched. */
  setImage: (image: PlanImage) => void
}

export function createFloorActions(
  set: (partial: Partial<FloorListState>) => void,
  get: () => FloorListState,
): FloorListActions {
  return {
    setActiveFloor: (id) => {
      const { activeFloorId, floors } = get()
      if (activeFloorId === id) return
      if (!floors.some((floor) => floor.id === id)) return
      set({ activeFloorId: id })
    },

    addFloor: (name) => {
      const { floors } = get()
      const trimmedName = name?.trim()
      const newFloor = createEmptyFloor(crypto.randomUUID(), trimmedName ? trimmedName : defaultFloorName(floors))
      const next = addFloorToList(floors, newFloor)
      if (next === floors) return
      set({ floors: next, activeFloorId: newFloor.id })
    },

    renameFloor: (id, name) => {
      const { floors } = get()
      const next = renameFloorInList(floors, id, name)
      if (next !== floors) set({ floors: next })
    },

    moveFloor: (id, toIndex) => {
      const { floors, shafts } = get()
      const moved = moveFloorInList(floors, id, toIndex)
      if (moved === floors) return
      // Reordering can break a link's "ONE legal adjacent floor" rule even though no hub moved;
      // it cannot affect a shaft (no stored range), but the pass is shared and cheap on a no-op.
      const pruned = pruneCrossFloorAndShaftState(moved, shafts)
      set({ floors: pruned.floors, shafts: pruned.shafts })
    },

    deleteFloor: (id) => {
      const { floors, activeFloorId, shafts } = get()
      const deletedIndex = floors.findIndex((floor) => floor.id === id)
      const removed = removeFloorFromList(floors, id)
      if (removed === floors) return
      // H2: nearest neighbour by index when deleting the ACTIVE floor, not always `next[0]`.
      const nextActiveFloorId = activeFloorId === id ? removed[nearestFloorIndexAfterRemoval(deletedIndex, removed.length)].id : activeFloorId
      // The deleted floor's hubs/markers are gone too - any OTHER floor linked to one of them, or a
      // shaft left with no markers anywhere, gets pruned here, same undo step.
      const pruned = pruneCrossFloorAndShaftState(removed, shafts)
      set({ floors: pruned.floors, shafts: pruned.shafts, activeFloorId: nextActiveFloorId })
    },

    setFloorHeight: (id, floorHeightM) => {
      const { floors } = get()
      const index = floors.findIndex((floor) => floor.id === id)
      if (index === -1 || floors[index].floorHeightM === floorHeightM) return
      set({ floors: floors.map((floor, i) => (i === index ? { ...floor, floorHeightM } : floor)) })
    },

    setImage: (image) => {
      set(
        patchActiveFloor(get(), {
          image,
          scale: null,
          cameras: [],
          walls: [],
          sensors: [],
          hubs: [],
          cables: [],
          fireAlarmDevices: [],
        }),
      )
    },
  }
}
