import { create } from 'zustand'
import { temporal } from 'zundo'
import type { PlacedCamera, Project, ScaleCalibration } from '../domain/project-types'

/**
 * The project store: the floor-plan image, its scale calibration, and the
 * placed cameras. This is the thing that gets saved to / loaded from disk
 * (phase 6) and undone/redone (phase 6, via zundo - see the `temporal(...)`
 * wrapper below). View-only state (pan/zoom, tool mode, selection) lives in
 * `editor-ui-store.ts` instead, so it never pollutes the save payload or
 * undo history.
 */
export interface ProjectState {
  image: Project['image'] | null
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
}

export interface ProjectActions {
  /** Sets a newly loaded floor-plan image. Always clears cameras + scale: both are meaningless against a different plan. */
  setImage: (image: Project['image']) => void
  setScale: (scale: ScaleCalibration | null) => void
  addCamera: (camera: PlacedCamera) => void
  /** Merges `patch` into the camera matching `id`. No-op if the id is unknown. */
  updateCamera: (id: string, patch: Partial<Omit<PlacedCamera, 'id'>>) => void
  deleteCamera: (id: string) => void
  /** Replaces the whole project (used when loading a project file, phase 6). */
  replaceProject: (project: Project) => void
  /** Clears back to the empty-project state (no image, no scale, no cameras). */
  resetProject: () => void
}

export type ProjectStore = ProjectState & ProjectActions

const INITIAL_STATE: ProjectState = {
  image: null,
  scale: null,
  cameras: [],
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
    (set) => ({
      ...INITIAL_STATE,

      // A new/replaced image or project makes every prior undo step point at
      // cameras/scale that no longer belong to the picture on screen -
      // clearing history outright is simpler and safer than trying to keep
      // it coherent across a swapped plan.
      setImage: (image) => {
        set({ image, scale: null, cameras: [] })
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

      replaceProject: (project) => {
        set({ image: project.image, scale: project.scale, cameras: project.cameras })
        useProjectStore.temporal.getState().clear()
      },

      resetProject: () => {
        set({ ...INITIAL_STATE, cameras: [] })
        useProjectStore.temporal.getState().clear()
      },
    }),
    {
      // Never track `image`: it can be tens of MB as a data URL, and nobody
      // expects undo to bring back a different floor plan. Cameras + scale
      // are the only things a user thinks of as "my layout".
      partialize: (state) => ({ cameras: state.cameras, scale: state.scale }),
      limit: 100,
    },
  ),
)
