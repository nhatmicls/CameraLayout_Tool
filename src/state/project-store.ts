import { create } from 'zustand'
import { temporal } from 'zundo'
import type { PlacedCamera, Project, ScaleCalibration, Wall } from '../domain/project-types'
import { moveWallNode, type WallNode } from '../domain/wall-node-editing'

/**
 * The project store: the floor-plan image, its scale calibration, the
 * placed cameras and the drawn walls. This is the thing that gets saved to / loaded from disk
 * (phase 6) and undone/redone (phase 6, via zundo - see the `temporal(...)`
 * wrapper below). View-only state (pan/zoom, tool mode, selection) lives in
 * `editor-ui-store.ts` instead, so it never pollutes the save payload or
 * undo history.
 */
export interface ProjectState {
  image: Project['image'] | null
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
  walls: Wall[]
}

export interface ProjectActions {
  /** Sets a newly loaded floor-plan image. Always clears cameras, walls + scale: all are meaningless against a different plan. */
  setImage: (image: Project['image']) => void
  setScale: (scale: ScaleCalibration | null) => void
  addCamera: (camera: PlacedCamera) => void
  /** Merges `patch` into the camera matching `id`. No-op if the id is unknown. */
  updateCamera: (id: string, patch: Partial<Omit<PlacedCamera, 'id'>>) => void
  deleteCamera: (id: string) => void
  addWall: (wall: Wall) => void
  /** Merges `patch` into the wall matching `id`. An unknown id leaves the state (and so the undo history) untouched. */
  updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void
  /** An unknown id leaves the state (and so the undo history) untouched - the selected id can be stale after an undo. */
  deleteWall: (id: string) => void
  /** Moves the wall node at exactly `from` (every wall end on it) to `to`, as one undo step. A refused or empty move leaves the state untouched. */
  moveWallNode: (from: WallNode, to: WallNode) => void
  /** Replaces the whole project (used when loading a project file, phase 6). */
  replaceProject: (project: Project) => void
  /** Clears back to the empty-project state (no image, no scale, no cameras, no walls). */
  resetProject: () => void
}

export type ProjectStore = ProjectState & ProjectActions

const INITIAL_STATE: ProjectState = {
  image: null,
  scale: null,
  cameras: [],
  walls: [],
}

// `setImage`/`replaceProject`/`resetProject` below call `useProjectStore.temporal` -
// a reference to the store this very `create()(...)` call produces. That's safe
// despite looking circular: these are closures that only run once a caller
// invokes the action, by which time module evaluation (and so this
// assignment) has already completed. This is zundo's own documented pattern
// for clearing history (see its README's "access temporal functions" section) -
// the alternative (a `StateCreator`'s third `api` argument) does not carry
// enough type information for `api.temporal` to type-check.
export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set, get) => ({
      ...INITIAL_STATE,

      // A new/replaced image or project makes every prior undo step point at
      // cameras/scale that no longer belong to the picture on screen -
      // clearing history outright is simpler and safer than trying to keep
      // it coherent across a swapped plan.
      setImage: (image) => {
        set({ image, scale: null, cameras: [], walls: [] })
        useProjectStore.temporal.getState().clear()
      },

      setScale: (scale) => set({ scale }),

      addCamera: (camera) => set((state) => ({ cameras: [...state.cameras, camera] })),

      updateCamera: (id, patch) =>
        set((state) => ({
          cameras: state.cameras.map((camera) => (camera.id === id ? { ...camera, ...patch } : camera)),
        })),

      deleteCamera: (id) =>
        set((state) => ({ cameras: state.cameras.filter((camera) => camera.id !== id) })),

      addWall: (wall) => set((state) => ({ walls: [...state.walls, wall] })),

      // zundo records a step for every `set` call, changed or not, so an unknown id must not reach `set`.
      updateWall: (id, patch) => {
        if (!get().walls.some((wall) => wall.id === id)) return
        set((state) => ({ walls: state.walls.map((wall) => (wall.id === id ? { ...wall, ...patch } : wall)) }))
      },

      deleteWall: (id) => {
        if (!get().walls.some((wall) => wall.id === id)) return
        set((state) => ({ walls: state.walls.filter((wall) => wall.id !== id) }))
      },

      moveWallNode: (from, to) => {
        const walls = moveWallNode(get().walls, from, to)
        if (walls) set({ walls })
      },

      replaceProject: (project) => {
        set({ image: project.image, scale: project.scale, cameras: project.cameras, walls: project.walls })
        useProjectStore.temporal.getState().clear()
      },

      resetProject: () => {
        set({ ...INITIAL_STATE, cameras: [], walls: [] })
        useProjectStore.temporal.getState().clear()
      },
    }),
    {
      // Never track `image`: it can be tens of MB as a data URL, and nobody
      // expects undo to bring back a different floor plan. Cameras, walls +
      // scale are the things a user thinks of as "my layout".
      partialize: (state) => ({ cameras: state.cameras, scale: state.scale, walls: state.walls }),
      limit: 100,
    },
  ),
)
