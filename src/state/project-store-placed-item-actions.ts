import { removeCablesOfDevice } from '../domain/cable/cable-reference-integrity'
import type { Cable } from '../domain/cable/cable-layout-types'
import type { PlacedCamera, ScaleCalibration, Wall } from '../domain/project-file/project-types'
import { applyPlacedSensorPatch } from '../domain/sensor/placed-sensor-patch'
import type { PlacedSensor, PlacedSensorPatch } from '../domain/sensor/sensor-types'
import { moveWallNode } from '../domain/wall/wall-node-editing'
import type { WallNode } from '../domain/wall/wall-node-editing'

/**
 * The scale/camera/wall/sensor slice of the project store - moved out of
 * `project-store.ts` (phase 2) so that file can wire these onto the ACTIVE
 * floor instead of flat top-level fields, mirroring
 * `project-store-cabling-actions.ts`'s adapter-lambda pattern. `cables` is
 * part of this slice's state only so `deleteCamera`/`deleteSensor` can prune
 * the deleted device's cables in the same `set()` (one undo step) - it is
 * never otherwise read or written here.
 */
export interface PlacedItemState {
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  cables: Cable[]
}

export interface PlacedItemActions {
  setScale: (scale: ScaleCalibration | null) => void
  addCamera: (camera: PlacedCamera) => void
  /** Merges `patch` into the camera matching `id`. No-op if the id is unknown. */
  updateCamera: (id: string, patch: Partial<Omit<PlacedCamera, 'id'>>) => void
  /** Also removes the camera's cables, in the same undo step. */
  deleteCamera: (id: string) => void
  addWall: (wall: Wall) => void
  /** Merges `patch` into the wall matching `id`. An unknown id leaves the state (and so the undo history) untouched. */
  updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void
  /** An unknown id leaves the state (and so the undo history) untouched - the selected id can be stale after an undo. */
  deleteWall: (id: string) => void
  /** Moves the wall node at exactly `from` (every wall end on it) to `to`, as one undo step. A refused or empty move leaves the state untouched. */
  moveWallNode: (from: WallNode, to: WallNode) => void
  addSensor: (sensor: PlacedSensor) => void
  /** Merges `patch` into the sensor matching `id` via `applyPlacedSensorPatch`. An unknown id leaves the state (and so the undo history) untouched. */
  updateSensor: (id: string, patch: PlacedSensorPatch) => void
  /** Also removes the sensor's cables, in the same undo step. An unknown id leaves the state (and so the undo history) untouched - the selected id can be stale after an undo. */
  deleteSensor: (id: string) => void
}

export function createPlacedItemActions(
  set: (partial: Partial<PlacedItemState>) => void,
  get: () => PlacedItemState,
): PlacedItemActions {
  return {
    setScale: (scale) => set({ scale }),

    addCamera: (camera) => set({ cameras: [...get().cameras, camera] }),

    updateCamera: (id, patch) =>
      set({ cameras: get().cameras.map((camera) => (camera.id === id ? { ...camera, ...patch } : camera)) }),

    deleteCamera: (id) =>
      set({
        cameras: get().cameras.filter((camera) => camera.id !== id),
        cables: removeCablesOfDevice(get().cables, 'camera', id),
      }),

    addWall: (wall) => set({ walls: [...get().walls, wall] }),

    updateWall: (id, patch) => {
      if (!get().walls.some((wall) => wall.id === id)) return
      set({ walls: get().walls.map((wall) => (wall.id === id ? { ...wall, ...patch } : wall)) })
    },

    deleteWall: (id) => {
      if (!get().walls.some((wall) => wall.id === id)) return
      set({ walls: get().walls.filter((wall) => wall.id !== id) })
    },

    moveWallNode: (from, to) => {
      const walls = moveWallNode(get().walls, from, to)
      if (walls) set({ walls })
    },

    addSensor: (sensor) => set({ sensors: [...get().sensors, sensor] }),

    updateSensor: (id, patch) => {
      const sensors = get().sensors
      const index = sensors.findIndex((sensor) => sensor.id === id)
      if (index === -1) return
      const updated = applyPlacedSensorPatch(sensors[index], patch)
      if (updated === sensors[index]) return
      set({ sensors: sensors.map((sensor, i) => (i === index ? updated : sensor)) })
    },

    deleteSensor: (id) => {
      if (!get().sensors.some((sensor) => sensor.id === id)) return
      set({
        sensors: get().sensors.filter((sensor) => sensor.id !== id),
        cables: removeCablesOfDevice(get().cables, 'sensor', id),
      })
    },
  }
}
