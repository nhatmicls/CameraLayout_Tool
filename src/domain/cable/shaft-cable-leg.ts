import type { FloorItemLabelContext } from '../floor/floor-item-label-allocator'
import type { Floor } from '../floor/floor-types'
import { buildCableEndpointIndex, cableEndRefKey, resolveCableEnd, type CableEndPoint, type CableEndpointIndex } from './cable-endpoint-index'
import type { Cable, CablePoint, Hub } from './cable-layout-types'

/**
 * A cable that ends on a shaft opening may carry its OWN route beyond the
 * shaft (`Cable.beyondShaft`): on one floor (the exit floor), from that
 * floor's opening of the same shaft to a hub or a device there. This module
 * is the one place that resolves, validates and lists those legs - the
 * estimate, the cable's own end-to-end label ("F1_C1_?" until routed, then
 * "F1_C1_F2_H1" - `cable-end-to-end-label.ts` walks this leg through
 * `cross-floor-route-walker.ts`), the canvas, the shaft panel, the store
 * cascades and the loader all read through it.
 *
 * The cable stays on (and is counted on) the floor of its start device; only
 * the leg's `floorId` names the exit floor.
 */

/**
 * Optional context for labels and speed. Positions never depend on any of
 * it. Extends `FloorItemLabelContext` (`floor-item-label-allocator.ts`) -
 * the SAME `shaftIds`/`fireAlarmModelById` shape every label producer reads,
 * plus the index cache below.
 */
export interface ShaftLegLookups extends FloorItemLabelContext {
  /** Filled as floors are indexed, so one pass over many cables indexes each floor once. Only valid for ONE `floors` array. */
  indexCache?: Map<string, CableEndpointIndex>
}

/** Every cable end on `floor` (cameras, sensors, fire-alarm devices, hubs). */
export function buildFloorCableEndpointIndex(floor: Floor, lookups?: ShaftLegLookups): CableEndpointIndex {
  const cached = lookups?.indexCache?.get(floor.id)
  if (cached) return cached
  const index = buildCableEndpointIndex(floor.cameras, floor.sensors, floor.hubs, lookups?.shaftIds, {
    devices: floor.fireAlarmDevices,
    modelById: lookups?.fireAlarmModelById,
  })
  lookups?.indexCache?.set(floor.id, index)
  return index
}

/** The shaft opening `cable` ends on, on its own floor - undefined when it ends on anything else. */
export function findCableShaftMarker(floor: Floor, cable: Cable): Hub | undefined {
  if (cable.hubId === undefined) return undefined
  const hub = floor.hubs.find((candidate) => candidate.id === cable.hubId)
  return hub?.kind === 'shaft' && hub.shaftId ? hub : undefined
}

export interface ResolvedShaftLeg {
  cable: Cable
  /** Floor of the cable (and of its start device). */
  sourceFloorIndex: number
  exitFloorIndex: number
  /** The exit floor's own opening of the cable's shaft - where the leg starts. */
  marker: Hub
  end: CableEndPoint
  /** `[marker, ...points, end]` in the EXIT floor's image px. */
  pathPx: CablePoint[]
}

/**
 * The leg of `cable` beyond its shaft, or null when it has none or the leg
 * no longer resolves: the cable does not end on a shaft opening, the exit
 * floor or its opening of that shaft is gone, the end is missing, is a shaft
 * opening, names both / neither of a hub and a device, or is the cable's own
 * start device.
 */
export function resolveShaftLeg(floors: readonly Floor[], sourceFloorIndex: number, cable: Cable, lookups?: ShaftLegLookups): ResolvedShaftLeg | null {
  const leg = cable.beyondShaft
  const sourceFloor = floors[sourceFloorIndex]
  if (!leg || !sourceFloor) return null
  const entry = findCableShaftMarker(sourceFloor, cable)
  if (!entry) return null

  const exitFloorIndex = floors.findIndex((floor) => floor.id === leg.floorId)
  if (exitFloorIndex === -1) return null
  const exitFloor = floors[exitFloorIndex]
  const marker = exitFloor.hubs.find((hub) => hub.kind === 'shaft' && hub.shaftId === entry.shaftId)
  if (!marker) return null

  if ((leg.hubId === undefined) === (leg.endDevice === undefined)) return null
  if (leg.hubId !== undefined && exitFloor.hubs.find((hub) => hub.id === leg.hubId)?.kind === 'shaft') return null
  if (leg.endDevice && exitFloorIndex === sourceFloorIndex && cableEndRefKey(leg.endDevice) === cableEndRefKey(cable.device)) return null

  const end = resolveCableEnd(leg, buildFloorCableEndpointIndex(exitFloor, lookups))
  if (!end) return null
  return {
    cable,
    sourceFloorIndex,
    exitFloorIndex,
    marker,
    end,
    pathPx: [{ x: marker.x, y: marker.y }, ...leg.points, { x: end.x, y: end.y }],
  }
}

/**
 * Clears every `beyondShaft` that no longer resolves (`resolveShaftLeg`) -
 * the cable itself stays, back to "not routed". Run by the store after any
 * write that can remove a leg's end, opening or floor (same `set()` as the
 * cause) and by the loader. Same `floors` reference when nothing needed
 * clearing; a project with no leg at all returns at once.
 */
export function pruneInvalidShaftLegs(floors: readonly Floor[], warnings?: string[]): Floor[] {
  if (!floors.some((floor) => floor.cables.some((cable) => cable.beyondShaft))) return floors as Floor[]
  const lookups: ShaftLegLookups = { indexCache: new Map() }
  let changed = false
  const next = floors.map((floor, floorIndex) => {
    let floorChanged = false
    const cables = floor.cables.map((cable) => {
      if (!cable.beyondShaft || resolveShaftLeg(floors, floorIndex, cable, lookups)) return cable
      floorChanged = true
      warnings?.push(`Cable "${cable.id}"'s route beyond its shaft is no longer valid; cleared.`)
      const cleared = { ...cable }
      delete cleared.beyondShaft
      return cleared
    })
    if (!floorChanged) return floor
    changed = true
    return { ...floor, cables }
  })
  return changed ? next : (floors as Floor[])
}

/** Every leg that runs on the floor `exitFloorId`, whichever floor its cable belongs to - what that floor's canvas / PNG draws. */
export function findShaftLegsOnFloor(floors: readonly Floor[], exitFloorId: string, lookups?: ShaftLegLookups): ResolvedShaftLeg[] {
  const legs: ResolvedShaftLeg[] = []
  floors.forEach((floor, floorIndex) => {
    for (const cable of floor.cables) {
      if (cable.beyondShaft?.floorId !== exitFloorId) continue
      const leg = resolveShaftLeg(floors, floorIndex, cable, lookups)
      if (leg) legs.push(leg)
    }
  })
  return legs
}

export interface ShaftCableEntry {
  /** Floor the cable enters the shaft on. */
  floorIndex: number
  cable: Cable
  /** "C1", "S2tx", "P1" - the start device's label on its own floor; "?" when it is gone. */
  deviceLabel: string
  /** null = not routed beyond the shaft yet. */
  leg: ResolvedShaftLeg | null
}

/** Every cable entering `shaftId` on any floor, in floor then cable order - the shaft panel's "from C1" list. */
export function listShaftCables(floors: readonly Floor[], shaftId: string, lookups?: ShaftLegLookups): ShaftCableEntry[] {
  const entries: ShaftCableEntry[] = []
  floors.forEach((floor, floorIndex) => {
    const marker = floor.hubs.find((hub) => hub.kind === 'shaft' && hub.shaftId === shaftId)
    if (!marker) return
    const index = buildFloorCableEndpointIndex(floor, lookups)
    for (const cable of floor.cables) {
      if (cable.hubId !== marker.id) continue
      entries.push({
        floorIndex,
        cable,
        deviceLabel: index.deviceByKey.get(cableEndRefKey(cable.device))?.label ?? '?',
        leg: resolveShaftLeg(floors, floorIndex, cable, lookups),
      })
    }
  })
  return entries
}

/**
 * True when the ONLY difference between `before` and `after` (the same
 * floor, two snapshots) is the route beyond a shaft of one or more of its
 * cables, and every such route runs - before or after - on the floor
 * `exitFloorId`. Undo / redo uses it to stay on the exit floor: the line
 * that appeared or vanished is there, not on the cable's own floor.
 */
export function isOnlyShaftLegChangeOnFloor(before: Floor, after: Floor, exitFloorId: string): boolean {
  const sameElsewhere =
    before.image === after.image &&
    before.scale === after.scale &&
    before.floorHeightM === after.floorHeightM &&
    before.name === after.name &&
    before.cameras === after.cameras &&
    before.walls === after.walls &&
    before.sensors === after.sensors &&
    before.hubs === after.hubs &&
    before.fireAlarmDevices === after.fireAlarmDevices
  if (!sameElsewhere || before.cables.length !== after.cables.length) return false

  let legChanged = false
  for (let i = 0; i < before.cables.length; i++) {
    const was = before.cables[i]
    const now = after.cables[i]
    if (was === now) continue
    const { beyondShaft: wasLeg, ...wasRest } = was
    const { beyondShaft: nowLeg, ...nowRest } = now
    if (JSON.stringify(wasRest) !== JSON.stringify(nowRest)) return false
    if (wasLeg?.floorId !== exitFloorId && nowLeg?.floorId !== exitFloorId) return false
    legChanged = true
  }
  return legChanged
}
