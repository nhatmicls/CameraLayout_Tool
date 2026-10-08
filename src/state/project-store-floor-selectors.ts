/**
 * Read helpers over `ProjectState.floors` + `activeFloorId`: the active
 * `Floor` itself, plus one selector per field a component used to read flat
 * off the store (`s.image`, `s.cameras`, ...). Every consumer that read a
 * flat field now reads `selectX(state)` instead - the compiler lists every
 * site once the flat fields are removed from `ProjectState`.
 *
 * `cableTypes`/`cableSettings`/`fireAlarmSettings` stay directly on
 * `ProjectState` (project-wide, not per floor - see the plan's drift
 * addendum); `selectProject` below is the one place that reassembles them
 * with `floors`/`shafts` into the `Project` shape a few call sites need.
 */
import type { Floor } from '../domain/floor/floor-types'
import type { Project } from '../domain/project-file/project-types'

type FloorLookup = Pick<{ floors: Floor[]; activeFloorId: string }, 'floors' | 'activeFloorId'>

type ProjectLookup = Pick<Project, 'floors' | 'shafts' | 'cableTypes' | 'cableSettings' | 'fireAlarmSettings'>

/** Assembles the `Project`-shaped slice of `ProjectState` (phase 7) - every `buildCombinedBomRows`/`computeProjectCableEstimate` call site built this same 5-field literal by hand before this helper existed. */
export function selectProject(state: ProjectLookup): Project {
  return {
    floors: state.floors,
    shafts: state.shafts,
    cableTypes: state.cableTypes,
    cableSettings: state.cableSettings,
    fireAlarmSettings: state.fireAlarmSettings,
  }
}

/** The active floor, or `floors[0]` as a defensive fallback if `activeFloorId` ever points at nothing (should not happen - every mutation clamps it). */
export function selectActiveFloor(state: FloorLookup): Floor {
  return state.floors.find((floor) => floor.id === state.activeFloorId) ?? state.floors[0]
}

/** Same function as `selectActiveFloor`, named for `useProjectStore.getState()` call sites (`getActiveFloor(useProjectStore.getState())`) rather than as a zustand selector hook - kept as one implementation (DRY). */
export const getActiveFloor = selectActiveFloor

export const selectImage = (state: FloorLookup) => selectActiveFloor(state).image
export const selectScale = (state: FloorLookup) => selectActiveFloor(state).scale
export const selectCameras = (state: FloorLookup) => selectActiveFloor(state).cameras
export const selectWalls = (state: FloorLookup) => selectActiveFloor(state).walls
export const selectSensors = (state: FloorLookup) => selectActiveFloor(state).sensors
export const selectHubs = (state: FloorLookup) => selectActiveFloor(state).hubs
export const selectCables = (state: FloorLookup) => selectActiveFloor(state).cables
export const selectFireAlarmDevices = (state: FloorLookup) => selectActiveFloor(state).fireAlarmDevices
