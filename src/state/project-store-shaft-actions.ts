import { pruneCrossFloorAndShaftState } from './project-store-active-floor-update'
import { findShaftExits } from '../domain/cable/shaft-integrity'
import { createShaftMarkers, removeShaft } from '../domain/cable/shaft-marker-lifecycle'
import { MAX_SHAFTS, SHAFT_NAME_MAX_LENGTH, type CablePoint, type Shaft } from '../domain/cable/cable-layout-types'
import type { Floor } from '../domain/floor/floor-types'

/**
 * The shaft slice of the project store: create / add an opening / rename /
 * delete a shaft, the shaft panel's bulk "assign the cables on this floor
 * without an exit" action, and the cable panel's own exit choice
 * (`setCableExitFloorId` - lives here, not the cabling slice, because
 * validating it needs the WHOLE `floors[]`, not just the active floor's own
 * slice - M7, phase 6 review). Like `project-store-cross-floor-link-actions.ts`,
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
  /** Removes every marker of the shaft, their cables, any trunk targeting one of them, and the shaft itself, THEN runs the same stale-exit-choice cascade every other cross-floor cascade does (M1) - one undo step. No-op if the id is unknown. */
  deleteShaft: (shaftId: string) => void
  /**
   * The shaft panel's bulk action: every cable on `floorId` ending on
   * `hubId` (that marker's own shaft) WITHOUT a currently-valid exit choice
   * gets `exitFloorId`. Refused (state untouched) when `exitFloorId` does
   * not name one of that shaft's current exits - never assigns to a
   * non-exit.
   */
  assignShaftCableExits: (floorId: string, hubId: string, exitFloorId: string) => void
  /**
   * The cable panel's "Exit" select, for the cable with `cableId` ON THE
   * ACTIVE FLOOR: sets `exitFloorId`, or (`null`) clears it. No-op (M7) when
   * the cable is unknown, its hub is not a shaft marker, or (when setting,
   * not clearing) `exitFloorId` does not name one of that shaft's current
   * exits - never assigns to a non-exit, never touches a non-shaft cable.
   */
  setCableExitFloorId: (cableId: string, exitFloorId: string | null) => void
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
      // M1 fix: route through the SAME stale-exit-choice cascade every other cross-floor-touching
      // cascade runs (deleteHub, moveFloor/deleteFloor, setHubTrunk) - defence in depth, even though
      // `removeShaft` already removes every cable that could be directly affected.
      const pruned = pruneCrossFloorAndShaftState(removed.floors, removed.shafts)
      set({ floors: pruned.floors, shafts: pruned.shafts })
    },

    assignShaftCableExits: (floorId, hubId, exitFloorId) => {
      const { floors } = get()
      const floorIndex = floors.findIndex((floor) => floor.id === floorId)
      if (floorIndex === -1) return
      const floor = floors[floorIndex]
      const hub = floor.hubs.find((candidate) => candidate.id === hubId)
      if (!hub || hub.kind !== 'shaft' || !hub.shaftId) return
      const exitFloorIds = new Set(findShaftExits(floors, hub.shaftId).map((exit) => exit.floorId))
      if (!exitFloorIds.has(exitFloorId)) return // refuses a floor that is not an exit

      let changed = false
      const cables = floor.cables.map((cable) => {
        if (cable.hubId !== hubId) return cable
        const hasValidChoice = cable.exitFloorId !== undefined && exitFloorIds.has(cable.exitFloorId)
        if (hasValidChoice) return cable
        changed = true
        return { ...cable, exitFloorId }
      })
      if (!changed) return
      set({ floors: floors.map((f, i) => (i === floorIndex ? { ...f, cables } : f)) })
    },

    setCableExitFloorId: (cableId, exitFloorId) => {
      const { floors, activeFloorId } = get()
      const floorIndex = floors.findIndex((floor) => floor.id === activeFloorId)
      if (floorIndex === -1) return
      const floor = floors[floorIndex]
      const cable = floor.cables.find((candidate) => candidate.id === cableId)
      if (!cable) return
      const hub = floor.hubs.find((candidate) => candidate.id === cable.hubId)
      if (!hub || hub.kind !== 'shaft' || !hub.shaftId) return // M7: only meaningful for a shaft-ending cable
      if (exitFloorId !== null) {
        const exitFloorIds = new Set(findShaftExits(floors, hub.shaftId).map((exit) => exit.floorId))
        if (!exitFloorIds.has(exitFloorId)) return // M7: never assigns to a non-exit
      }
      const next = exitFloorId ?? undefined
      if (cable.exitFloorId === next) return
      const cables = floor.cables.map((candidate) => (candidate.id === cableId ? { ...candidate, exitFloorId: next } : candidate))
      set({ floors: floors.map((f, i) => (i === floorIndex ? { ...f, cables } : f)) })
    },
  }
}
