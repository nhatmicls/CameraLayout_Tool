import { create } from 'zustand'
import { temporal } from 'zundo'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../domain/fire-alarm/fire-alarm-device-types'
import { removeCablesOfDevice } from '../domain/cable/cable-reference-integrity'
import { applyPlacedSensorPatch } from '../domain/sensor/placed-sensor-patch'
import { moveWallNode } from '../domain/wall/wall-node-editing'
import { createCablingActions } from './project-store-cabling-actions'
import { createFireAlarmActions } from './project-store-fire-alarm-actions'
import {
  createInitialProjectState,
  type ProjectStore,
} from './project-store-state-and-action-types'

export type { ProjectState, ProjectActions, ProjectStore } from './project-store-state-and-action-types'

/**
 * The project store: the floor-plan image, its scale calibration, the
 * placed cameras, sensors, fire-alarm devices and the drawn walls. This is
 * the thing that gets saved to / loaded from disk and undone/redone (via
 * zundo - see the `temporal(...)` wrapper below). View-only state (pan/zoom,
 * tool mode, selection) lives in `editor-ui-store.ts` instead, so it never
 * pollutes the save payload or undo history.
 */

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
      ...createInitialProjectState(),

      // A new/replaced image or project makes every prior undo step point at
      // cameras/scale that no longer belong to the picture on screen -
      // clearing history outright is simpler and safer than trying to keep
      // it coherent across a swapped plan.
      setImage: (image) => {
        // Cable types + allowances are kept: typed prices are not plan geometry.
        set({
          image,
          scale: null,
          cameras: [],
          walls: [],
          sensors: [],
          hubs: [],
          cables: [],
          fireAlarmDevices: [],
          fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
        })
        useProjectStore.temporal.getState().clear()
      },

      setScale: (scale) => set({ scale }),

      addCamera: (camera) => set((state) => ({ cameras: [...state.cameras, camera] })),

      updateCamera: (id, patch) =>
        set((state) => ({
          cameras: state.cameras.map((camera) => (camera.id === id ? { ...camera, ...patch } : camera)),
        })),

      // One `set()` = one undo step for the camera and its cables. `removeCablesOf*` return the same
      // array when nothing matched, so a cable-free project keeps its `cables` identity.
      deleteCamera: (id) =>
        set((state) => ({
          cameras: state.cameras.filter((camera) => camera.id !== id),
          cables: removeCablesOfDevice(state.cables, 'camera', id),
        })),

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

      addSensor: (sensor) => set((state) => ({ sensors: [...state.sensors, sensor] })),

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
        set((state) => ({
          sensors: state.sensors.filter((sensor) => sensor.id !== id),
          cables: removeCablesOfDevice(state.cables, 'sensor', id),
        }))
      },

      // Thin lambdas: zundo's `set` / `get` are typed for the whole store, each slice only needs its own keys.
      ...createCablingActions(
        (partial) => set(partial),
        () => get(),
      ),
      ...createFireAlarmActions(
        (partial) => set(partial),
        () => get(),
      ),

      replaceProject: (project) => {
        set({
          image: project.image,
          scale: project.scale,
          cameras: project.cameras,
          walls: project.walls,
          sensors: project.sensors,
          hubs: project.hubs,
          cables: project.cables,
          cableTypes: project.cableTypes,
          cableSettings: project.cableSettings,
          fireAlarmDevices: project.fireAlarmDevices,
          fireAlarmSettings: project.fireAlarmSettings,
        })
        useProjectStore.temporal.getState().clear()
      },

      resetProject: () => {
        set(createInitialProjectState())
        useProjectStore.temporal.getState().clear()
      },
    }),
    {
      // Never track `image`: it can be tens of MB as a data URL, and nobody
      // expects undo to bring back a different floor plan. Cameras, walls,
      // sensors, fire-alarm devices/settings + scale are the things a user
      // thinks of as "my layout".
      partialize: (state) => ({
        cameras: state.cameras,
        scale: state.scale,
        walls: state.walls,
        sensors: state.sensors,
        hubs: state.hubs,
        cables: state.cables,
        cableTypes: state.cableTypes,
        cableSettings: state.cableSettings,
        fireAlarmDevices: state.fireAlarmDevices,
        fireAlarmSettings: state.fireAlarmSettings,
      }),
      limit: 100,
    },
  ),
)
