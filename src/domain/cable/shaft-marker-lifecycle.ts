import { clampPointToImageBounds } from '../shared/clamp'
import type { Floor } from '../floor/floor-types'
import { MAX_HUBS, type CablePoint, type Hub, type Shaft } from './cable-layout-types'
import { findShaftMarkers } from './shaft-integrity'

/**
 * Create/delete of a shaft's markers across floors - split out of
 * `shaft-integrity.ts` to keep that file under 200 lines.
 */

/**
 * Creates one marker of `shaftId` on every floor from index `fromFloorIndex`
 * to `toFloorIndex` (inclusive, order-independent) that has an image, is not
 * already at `MAX_HUBS`, and does not already hold a marker of this SAME
 * shaft (M2, phase 6 review: "at most one marker per shaft per floor" is an
 * invariant, not a suggestion - `addShaftOpening`'s single-floor call relies
 * on this to refuse rather than create a duplicate) - skipped floors are
 * named, never silently dropped. Each marker starts at `pointPx`, clamped to
 * that floor's own image bounds (plans are rarely aligned - the user drags
 * each into place). `newId` is called once per marker placed (a store
 * action supplies `crypto.randomUUID`, kept out of this pure function).
 */
export function createShaftMarkers(
  floors: readonly Floor[],
  shaftId: string,
  fromFloorIndex: number,
  toFloorIndex: number,
  pointPx: CablePoint,
  newId: () => string,
): { floors: Floor[]; skippedFloorNames: string[] } {
  const lo = Math.min(fromFloorIndex, toFloorIndex)
  const hi = Math.max(fromFloorIndex, toFloorIndex)
  const skippedFloorNames: string[] = []
  const floorsNext = floors.map((floor, index) => {
    if (index < lo || index > hi) return floor
    if (!floor.image) {
      skippedFloorNames.push(`${floor.name} (no plan image)`)
      return floor
    }
    if (floor.hubs.length >= MAX_HUBS) {
      skippedFloorNames.push(`${floor.name} (at the ${MAX_HUBS}-hub limit)`)
      return floor
    }
    if (floor.hubs.some((hub) => hub.kind === 'shaft' && hub.shaftId === shaftId)) {
      skippedFloorNames.push(`${floor.name} (already has an opening for this shaft)`)
      return floor
    }
    const { x, y } = clampPointToImageBounds(pointPx, floor.image.widthPx, floor.image.heightPx)
    const marker: Hub = { id: newId(), kind: 'shaft', shaftId, x, y, mountHeightM: 0 }
    return { ...floor, hubs: [...floor.hubs, marker] }
  })
  return { floors: floorsNext, skippedFloorNames }
}

/**
 * Deletes every marker of `shaftId` on every floor, their cables, and the
 * shaft's own entry in `shafts[]`. Also clears any OTHER hub's `trunk` that
 * targeted one of these markers - a DEFENSIVE cleanup only: decision D1
 * (`cross-floor-hub-beyond-length-resolver.ts`) means a trunk can never
 * legally target a shaft marker on a live project, so this branch should be
 * unreachable in practice, but a deleted marker must never leave a dangling
 * `trunk.hubId` behind on the off chance one exists.
 */
export function removeShaft(floors: readonly Floor[], shafts: readonly Shaft[], shaftId: string): { floors: Floor[]; shafts: Shaft[] } {
  const markerHubIds = new Set(findShaftMarkers(floors, shaftId).map((marker) => marker.hub.id))
  const floorsNext = floors.map((floor) => {
    const hubs = floor.hubs.filter((hub) => !markerHubIds.has(hub.id)).map((hub) => {
      if (!hub.trunk || !markerHubIds.has(hub.trunk.hubId)) return hub
      const cleared = { ...hub }
      delete cleared.trunk
      return cleared
    })
    const cables = floor.cables.filter((cable) => cable.hubId === undefined || !markerHubIds.has(cable.hubId))
    if (hubs.length === floor.hubs.length && cables.length === floor.cables.length) return floor
    return { ...floor, hubs, cables }
  })
  return { floors: floorsNext, shafts: shafts.filter((shaft) => shaft.id !== shaftId) }
}
