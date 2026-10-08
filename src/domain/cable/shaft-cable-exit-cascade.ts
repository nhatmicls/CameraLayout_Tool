import type { Floor } from '../floor/floor-types'
import { hubLabels } from './cable-endpoint-index'
import { findShaftMarkers } from './shaft-integrity'

/**
 * Keeps `Cable.exitFloorId` choices coherent as a shaft's exits change -
 * split out of `shaft-integrity.ts` to keep that file under 200 lines.
 */

/**
 * On a shaft gaining its SECOND exit (`exitFloorId` is the floor of the
 * exit that was, until now, the shaft's only/implicit one): every cable of
 * this shaft that has no choice yet is stamped with it - preserving what
 * they were already implicitly using, never a guess. Same array reference
 * when nothing needed stamping.
 */
export function stampImplicitExitChoices(floors: readonly Floor[], shaftId: string, exitFloorId: string): Floor[] {
  const markerHubIds = new Set(findShaftMarkers(floors, shaftId).map((marker) => marker.hub.id))
  let changed = false
  const next = floors.map((floor) => {
    let floorChanged = false
    const cables = floor.cables.map((cable) => {
      if (!markerHubIds.has(cable.hubId) || cable.exitFloorId !== undefined) return cable
      floorChanged = true
      return { ...cable, exitFloorId }
    })
    if (!floorChanged) return floor
    changed = true
    return { ...floor, cables }
  })
  return changed ? next : (floors as Floor[])
}

/**
 * Clears `Cable.exitFloorId` wherever it no longer names a floor that is
 * CURRENTLY an exit of the shaft the cable's hub belongs to (hub deleted,
 * hub no longer a shaft marker, that marker's trunk removed, or the cable
 * doesn't end on a shaft marker at all). Recomputed fresh from the live
 * `floors` every time - no stale bookkeeping. Same array reference when
 * nothing needed clearing. Pushes one warning per cleared choice when
 * `warnings` is given (the loader wants them; the store's cascades do not).
 */
export function clearStaleExitChoices(floors: readonly Floor[], warnings?: string[]): Floor[] {
  const shaftIdByHubId = new Map<string, string>()
  const exitFloorIdsByShaftId = new Map<string, Set<string>>()
  for (const floor of floors) {
    for (const hub of floor.hubs) {
      if (hub.kind !== 'shaft' || !hub.shaftId) continue
      shaftIdByHubId.set(hub.id, hub.shaftId)
      if (hub.trunk) {
        const set = exitFloorIdsByShaftId.get(hub.shaftId) ?? new Set<string>()
        set.add(floor.id)
        exitFloorIdsByShaftId.set(hub.shaftId, set)
      }
    }
  }

  let changed = false
  const next = floors.map((floor) => {
    let floorChanged = false
    const cables = floor.cables.map((cable) => {
      if (cable.exitFloorId === undefined) return cable
      const shaftId = shaftIdByHubId.get(cable.hubId)
      const stillValid = shaftId !== undefined && (exitFloorIdsByShaftId.get(shaftId)?.has(cable.exitFloorId) ?? false)
      if (stillValid) return cable
      floorChanged = true
      warnings?.push(`Cable "${cable.id}"'s chosen shaft exit no longer exists; cleared.`)
      const cleared = { ...cable }
      delete cleared.exitFloorId
      return cleared
    })
    if (!floorChanged) return floor
    changed = true
    return { ...floor, cables }
  })
  return changed ? next : (floors as Floor[])
}

export interface ShaftExitCableCount {
  floorId: string
  floorName: string
  /** Label of the hub THIS exit's trunk routes to, e.g. "H2". */
  targetHubLabel: string
  count: number
}

export interface ShaftCableSummary {
  /** Every cable ending on any marker of this shaft, on any floor. */
  cablesIn: number
  perExit: ShaftExitCableCount[]
  /** Cables that could not resolve an exit (several exits exist, none chosen/valid) - never counted in any `perExit` bucket. */
  notChosen: number
}

/** The shaft panel's "in = out" summary: how many cables enter the whole shaft, how many leave at each exit, how many are stuck unchosen. */
export function summariseShaftCables(floors: readonly Floor[], shaftIds: readonly string[], shaftId: string): ShaftCableSummary {
  const markers = findShaftMarkers(floors, shaftId)
  const exits = markers.filter((marker) => marker.hub.trunk !== undefined)
  const perExit: ShaftExitCableCount[] = exits.map((exit) => {
    const floor = floors[exit.floorIndex]
    const labels = hubLabels(floor.hubs, shaftIds)
    const targetIndex = floor.hubs.findIndex((candidate) => candidate.id === exit.hub.trunk!.hubId)
    return { floorId: exit.floorId, floorName: floor.name, targetHubLabel: targetIndex >= 0 ? labels[targetIndex] : '?', count: 0 }
  })

  let cablesIn = 0
  let notChosen = 0
  for (const marker of markers) {
    const floor = floors[marker.floorIndex]
    for (const cable of floor.cables) {
      if (cable.hubId !== marker.hub.id) continue
      cablesIn += 1
      if (exits.length === 0) continue // typed fallback - not "unaccounted"
      if (exits.length === 1) {
        perExit[0].count += 1
        continue
      }
      const bucket = cable.exitFloorId ? perExit.find((exit) => exit.floorId === cable.exitFloorId) : undefined
      if (bucket) bucket.count += 1
      else notChosen += 1
    }
  }
  return { cablesIn, perExit, notChosen }
}
