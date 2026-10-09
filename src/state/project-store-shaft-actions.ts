import { pruneCrossFloorAndShaftState } from './project-store-active-floor-update'
import { resolveShaftLeg } from '../domain/cable/shaft-cable-leg'
import { createShaftMarkers, removeShaft } from '../domain/cable/shaft-marker-lifecycle'
import { MAX_SHAFTS, SHAFT_NAME_MAX_LENGTH, type CablePoint, type CableShaftLeg, type Shaft } from '../domain/cable/cable-layout-types'
import type { Floor } from '../domain/floor/floor-types'

/**
 * The shaft slice of the project store: create / add an opening / rename /
 * delete a shaft, and a cable's own route beyond its shaft
 * (`setCableShaftLeg` - lives here, not the cabling slice, because the cable
 * and its leg are on two floors). Like `project-store-cross-floor-link-actions.ts`,
 * every write here can touch several floors at once, so it sets `floors`
 * (and `shafts`) directly rather than going through `patchActiveFloor`.
 */
export interface ShaftActionsState {
  floors: Floor[]
  shafts: Shaft[]
  activeFloorId: string
}

export type CreateShaftResult = { ok: true; shaftId: string; skippedFloorNames: string[] } | { ok: false; reason: string }
export type AddShaftOpeningResult = { ok: true } | { ok: false; reason: string }

export interface ShaftActions {
  /** Refused (`ok: false`, no `set()`) at `MAX_SHAFTS`, or when EVERY floor in range is skipped (no image / at the hub limit) - a shaft with zero markers is never created (C2, phase 6 review). Markers are placed on every OTHER floor from `fromFloorIndex` to `toFloorIndex` (inclusive) - skipped floors are named, never silently dropped. One undo step. */
  createShaft: (name: string, fromFloorIndex: number, toFloorIndex: number, pointPx: CablePoint) => CreateShaftResult
  /** Adds one marker of `shaftId` on `floorIndex`. Refused (same reasons as `createShaft`'s per-floor skip, including a marker already there - M2) with no `set()`. */
  addShaftOpening: (shaftId: string, floorIndex: number, pointPx: CablePoint) => AddShaftOpeningResult
  /** Trims `name`. No-op if the id is unknown or the trimmed name is empty/unchanged. */
  renameShaft: (shaftId: string, name: string) => void
  /** Removes every marker of the shaft, their cables, any trunk targeting one of them, and the shaft itself, THEN runs the same cross-floor prune every other cross-floor cascade does - one undo step. No-op if the id is unknown. */
  deleteShaft: (shaftId: string) => void
  /**
   * Sets (or, with `leg: null`, removes) the route beyond its shaft of the
   * cable `cableId` on floor `floorId`. Refused (returns `false`, state
   * untouched) when the cable is unknown, does not end on a shaft opening,
   * or the leg does not resolve (`resolveShaftLeg`: the exit floor has no
   * opening of that shaft, the end is missing / a shaft opening / the
   * cable's own start). One undo step.
   */
  setCableShaftLeg: (floorId: string, cableId: string, leg: CableShaftLeg | null) => boolean
}

export function createShaftActions(
  set: (partial: Partial<ShaftActionsState>) => void,
  get: () => ShaftActionsState,
): ShaftActions {
  return {
    createShaft: (name, fromFloorIndex, toFloorIndex, pointPx) => {
      const { floors, shafts } = get()
      if (shafts.length >= MAX_SHAFTS) return { ok: false, reason: `A project can hold at most ${MAX_SHAFTS} shafts.` }
      const shaftId = crypto.randomUUID()
      const { floors: nextFloors, skippedFloorNames } = createShaftMarkers(floors, shaftId, fromFloorIndex, toFloorIndex, pointPx, () =>
        crypto.randomUUID(),
      )
      // C2 fix: a floor "created" with zero markers (every floor in range skipped) is never
      // appended to `shafts[]` at all - never a `set()`, never an undo step.
      const rangeSize = Math.abs(toFloorIndex - fromFloorIndex) + 1
      if (skippedFloorNames.length >= rangeSize) {
        return { ok: false, reason: `No floor in range could take an opening: ${skippedFloorNames.join(', ')}.` }
      }
      const trimmed = name.trim().slice(0, SHAFT_NAME_MAX_LENGTH)
      const shaft: Shaft = { id: shaftId, name: trimmed.length > 0 ? trimmed : `Shaft ${shafts.length + 1}` }
      set({ floors: nextFloors, shafts: [...shafts, shaft] })
      return { ok: true, shaftId, skippedFloorNames }
    },

    addShaftOpening: (shaftId, floorIndex, pointPx) => {
      const { floors, shafts } = get()
      if (!shafts.some((shaft) => shaft.id === shaftId)) return { ok: false, reason: 'That shaft no longer exists.' }
      const floor = floors[floorIndex]
      if (!floor) return { ok: false, reason: 'That floor no longer exists.' }
      const { floors: nextFloors, skippedFloorNames } = createShaftMarkers(floors, shaftId, floorIndex, floorIndex, pointPx, () =>
        crypto.randomUUID(),
      )
      if (skippedFloorNames.length > 0) return { ok: false, reason: skippedFloorNames[0] }
      set({ floors: nextFloors })
      return { ok: true }
    },

    renameShaft: (shaftId, name) => {
      const { shafts } = get()
      const trimmed = name.trim().slice(0, SHAFT_NAME_MAX_LENGTH)
      const index = shafts.findIndex((shaft) => shaft.id === shaftId)
      if (index === -1 || trimmed.length === 0 || shafts[index].name === trimmed) return
      set({ shafts: shafts.map((shaft, i) => (i === index ? { ...shaft, name: trimmed } : shaft)) })
    },

    deleteShaft: (shaftId) => {
      const { floors, shafts } = get()
      if (!shafts.some((shaft) => shaft.id === shaftId)) return
      const removed = removeShaft(floors, shafts, shaftId)
      // Route through the SAME cross-floor prune every other cross-floor-touching
      // cascade runs (deleteHub, moveFloor/deleteFloor, setHubTrunk) - defence in depth, even though
      // `removeShaft` already removes every cable that could be directly affected.
      const pruned = pruneCrossFloorAndShaftState(removed.floors, removed.shafts)
      set({ floors: pruned.floors, shafts: pruned.shafts })
    },

    setCableShaftLeg: (floorId, cableId, leg) => {
      const { floors } = get()
      const floorIndex = floors.findIndex((floor) => floor.id === floorId)
      const cable = floorIndex === -1 ? undefined : floors[floorIndex].cables.find((candidate) => candidate.id === cableId)
      if (!cable) return false

      let updated: typeof cable
      if (leg === null) {
        if (!cable.beyondShaft) return false
        updated = { ...cable }
        delete updated.beyondShaft
      } else {
        updated = { ...cable, beyondShaft: leg }
        if (!resolveShaftLeg(floors, floorIndex, updated)) return false
      }
      const cables = floors[floorIndex].cables.map((candidate) => (candidate.id === cableId ? updated : candidate))
      set({ floors: floors.map((floor, i) => (i === floorIndex ? { ...floor, cables } : floor)) })
      return true
    },
  }
}
