import type { Floor } from '../floor/floor-types'
import type { Hub, Shaft } from './cable-layout-types'

/**
 * Keeps a project's shafts (the vertical tube crossing model) coherent: one
 * rule set, reused by the loader, the store's create/delete/cascade actions
 * and the shaft panel.
 *
 * A shaft has NO stored floor range - it is derived from the per-floor
 * `Hub.kind === 'shaft'` markers (`shaftId` groups them), so a floor
 * delete/reorder needs no shaft-specific fix-up. A shaft carries no route of
 * its own: each cable entering it owns its route beyond it
 * (`Cable.beyondShaft`, `shaft-cable-leg.ts`). Marker creation/deletion lives
 * in `shaft-marker-lifecycle.ts`.
 */

export interface ShaftMarkerRef {
  floorIndex: number
  floorId: string
  hub: Hub
}

/** Every marker of `shaftId`, in floor order. At most one per floor (duplicates are a loader/integrity violation, pruned by `pruneShafts`). */
export function findShaftMarkers(floors: readonly Floor[], shaftId: string): ShaftMarkerRef[] {
  const result: ShaftMarkerRef[] = []
  floors.forEach((floor, floorIndex) => {
    const hub = floor.hubs.find((candidate) => candidate.kind === 'shaft' && candidate.shaftId === shaftId)
    if (hub) result.push({ floorIndex, floorId: floor.id, hub })
  })
  return result
}

/**
 * Loader-only, PER FLOOR, no shaft-list needed: fixes a hub's shaft-related
 * SHAPE before anything else sees it (decision D3, phase 6 review) - the
 * live store never produces these shapes, so this is never called from a
 * store action. A `kind: 'shaft'` marker with no `shaftId` is dropped
 * entirely (it cannot function); a non-shaft hub carrying a stray `shaftId`
 * has just that key cleared; a shaft marker carrying `link` has just `link`
 * cleared (a shaft marker never links - pair links are riser/drop only).
 * Runs BEFORE the cable-ref check (`normaliseLoadedFloorCabling`), so a
 * dropped marker's cables are reported by the ordinary "unknown hub"
 * warning rather than silently left dangling. One warning per fix,
 * UNPREFIXED (the caller prefixes with the floor name only when the file has
 * more than one floor - same convention as `dedupeById`'s own warnings).
 * Same `hubs` reference when nothing needed fixing.
 */
export function normaliseShaftMarkerShapes(hubs: readonly Hub[], warnings?: string[]): Hub[] {
  let changed = false
  const next: Hub[] = []
  for (const hub of hubs) {
    if (hub.kind === 'shaft' && hub.shaftId === undefined) {
      warnings?.push('a shaft marker has no shaftId; dropped.')
      changed = true
      continue
    }
    if (hub.kind !== 'shaft' && hub.shaftId !== undefined) {
      warnings?.push('a non-shaft hub carried a stray shaftId; cleared.')
      changed = true
      const cleared = { ...hub }
      delete cleared.shaftId
      next.push(cleared)
      continue
    }
    if (hub.kind === 'shaft' && hub.link !== undefined) {
      warnings?.push('a shaft marker cannot be linked; link cleared.')
      changed = true
      const cleared = { ...hub }
      delete cleared.link
      next.push(cleared)
      continue
    }
    next.push(hub)
  }
  return changed ? next : (hubs as Hub[])
}

/**
 * Drops a shaft marker whose `shaftId` is unknown (not in `shaftIds`) or
 * repeats another marker's `shaftId` on this SAME `hubs` array - both with
 * one UNPREFIXED warning (see `normaliseShaftMarkerShapes`'s own doc comment
 * on why - `pruneShafts`, below, prefixes with the floor name itself since
 * nothing else wraps its warnings). Same `hubs` reference when clean. Shared
 * by the loader's per-floor pre-pass (run BEFORE the cable-ref check, via
 * `normaliseLoadedFloorCabling`) and the store's full cascade (`pruneShafts`).
 */
export function pruneUnknownOrDuplicateShaftMarkers(hubs: readonly Hub[], shaftIds: ReadonlySet<string>, warnings?: string[]): Hub[] {
  const seenShaftIds = new Set<string>()
  let changed = false
  const next = hubs.filter((hub) => {
    if (hub.kind !== 'shaft') return true
    if (!hub.shaftId || !shaftIds.has(hub.shaftId)) {
      warnings?.push('a shaft marker references an unknown shaft; dropped.')
      changed = true
      return false
    }
    if (seenShaftIds.has(hub.shaftId)) {
      warnings?.push('a duplicate marker for the same shaft was dropped.')
      changed = true
      return false
    }
    seenShaftIds.add(hub.shaftId)
    return true
  })
  return changed ? next : (hubs as Hub[])
}

/**
 * Store-cascade pass (also safe to re-run from the loader - idempotent):
 * drops a shaft marker whose `shaftId` is unknown or already has a marker
 * on that floor (`pruneUnknownOrDuplicateShaftMarkers`, same rule as the
 * loader's per-floor pre-pass), then drops any `shafts[]` entry left with no
 * marker anywhere. Same `{ floors, shafts }` objects when nothing needed
 * pruning (so a clean project never records an empty undo step).
 */
export function pruneShafts(floors: readonly Floor[], shafts: readonly Shaft[], warnings?: string[]): { floors: Floor[]; shafts: Shaft[] } {
  const shaftIds = new Set(shafts.map((shaft) => shaft.id))
  let floorsChanged = false
  const floorsNext = floors.map((floor) => {
    const localWarnings: string[] = []
    const hubs = pruneUnknownOrDuplicateShaftMarkers(floor.hubs, shaftIds, localWarnings)
    if (hubs === floor.hubs) return floor
    floorsChanged = true
    warnings?.push(...localWarnings.map((w) => `${floor.name}: ${w}`))
    const keptIds = new Set(hubs.map((hub) => hub.id))
    const droppedIds = floor.hubs.filter((hub) => !keptIds.has(hub.id)).map((hub) => hub.id)
    const droppedIdSet = new Set(droppedIds)
    return { ...floor, hubs, cables: floor.cables.filter((cable) => cable.hubId === undefined || !droppedIdSet.has(cable.hubId)) }
  })

  const usedShaftIds = new Set<string>()
  for (const floor of floorsNext) {
    for (const hub of floor.hubs) {
      if (hub.kind === 'shaft' && hub.shaftId) usedShaftIds.add(hub.shaftId)
    }
  }
  const shaftsNext = shafts.filter((shaft) => {
    if (usedShaftIds.has(shaft.id)) return true
    warnings?.push(`Shaft "${shaft.name}" has no markers; dropped.`)
    return false
  })

  return {
    floors: floorsChanged ? floorsNext : (floors as Floor[]),
    shafts: shaftsNext.length === shafts.length ? (shafts as Shaft[]) : shaftsNext,
  }
}
