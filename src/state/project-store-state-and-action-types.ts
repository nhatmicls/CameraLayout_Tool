import { createEmptyCableLayout } from '../domain/cable/cable-layout-types'
import { createEmptyFireAlarmLayout } from '../domain/project-file/project-types'
import type { PlacedCamera, Project, ScaleCalibration, Wall } from '../domain/project-file/project-types'
import type { PlacedSensor, PlacedSensorPatch } from '../domain/sensor/sensor-types'
import type { WallNode } from '../domain/wall/wall-node-editing'
import type { CablingActions, CablingState } from './project-store-cabling-actions'
import type { FireAlarmActions, FireAlarmState } from './project-store-fire-alarm-actions'

/**
 * `ProjectState`/`ProjectActions`/`ProjectStore` and the initial-state
 * factory, extracted out of `project-store.ts` to keep that file under 200
 * lines (mirrors how the cabling and fire-alarm slices already live in
 * their own action files).
 */
export interface ProjectState extends CablingState, FireAlarmState {
  image: Project['image'] | null
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
}

export interface ProjectActions extends CablingActions, FireAlarmActions {
  /** Sets a newly loaded floor-plan image. Always clears cameras, walls, sensors, hubs, cables, fire-alarm devices + scale, and RESETS fire-alarm settings to `DEFAULT_FIRE_ALARM_SETTINGS`: all are meaningless against a different plan (CLAUDE.md). Only cable types + cable settings are kept - they describe a procurement convention, not plan geometry (see `project-store.ts`'s `setImage`). */
  setImage: (image: Project['image']) => void
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
  /** Replaces the whole project (used when loading a project file). */
  replaceProject: (project: Project) => void
  /** Clears back to the empty-project state (no image, no scale, no cameras, no walls, no sensors, no fire-alarm devices). */
  resetProject: () => void
}

export type ProjectStore = ProjectState & ProjectActions

/** A function, not a constant: every reset needs fresh arrays (and fresh default cable types / fire-alarm settings). */
export const createInitialProjectState = (): ProjectState => ({
  image: null,
  scale: null,
  cameras: [],
  walls: [],
  sensors: [],
  ...createEmptyCableLayout(),
  ...createEmptyFireAlarmLayout(),
})
