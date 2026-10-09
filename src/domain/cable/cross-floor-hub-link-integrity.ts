import { hubLabels } from './cable-endpoint-index'
import type { Hub, HubRef } from './cable-layout-types'
import type { Floor } from '../floor/floor-types'

/**
 * Keeps a riser/drop `link` (and the `trunk` that only makes sense while
 * linked) coherent: one rule set, reused by the loader (validate a file's
 * stored link), the store's prune cascades (hub delete, floor delete/move,
 * `setImage`), and the hub panel's picker/"Create paired point" button.
 *
 * A link is always symmetric - a riser on floor `i` pairs with a drop on
 * floor `i + 1`, a drop on `i` with a riser on `i - 1` - so every write here
 * updates both sides (or clears both) in one pass, never leaving a
 * one-sided link for the next read to trip over.
 */

/** Resolves `ref` against the live floor list - exported for `cross-floor-paired-hub-creator.ts`. */
export function resolveHubRef(floors: readonly Floor[], ref: HubRef): { floorIndex: number; hub: Hub } | null {
  const floorIndex = floors.findIndex((floor) => floor.id === ref.floorId)
  if (floorIndex === -1) return null
  const hub = floors[floorIndex].hubs.find((candidate) => candidate.id === ref.hubId)
  if (!hub) return null
  return { floorIndex, hub }
}

/** Replaces one hub inside `floors`, immutably. Returns the SAME `floors` reference when the ref doesn't resolve or `updater` returns the same object (no-op). Exported for `cross-floor-paired-hub-creator.ts`. */
export function updateHubInFloors(floors: readonly Floor[], ref: HubRef, updater: (hub: Hub) => Hub): Floor[] {
  const floorIndex = floors.findIndex((floor) => floor.id === ref.floorId)
  if (floorIndex === -1) return floors as Floor[]
  const floor = floors[floorIndex]
  const hubIndex = floor.hubs.findIndex((hub) => hub.id === ref.hubId)
  if (hubIndex === -1) return floors as Floor[]
  const updated = updater(floor.hubs[hubIndex])
  if (updated === floor.hubs[hubIndex]) return floors as Floor[]
  const hubs = floor.hubs.map((hub, i) => (i === hubIndex ? updated : hub))
  return floors.map((f, i) => (i === floorIndex ? { ...f, hubs } : f))
}

/** Drops `trunk` (and, with `alsoLink`, `link` too) by DELETING the keys, not just setting them to `undefined` - so in-memory state deep-equals a project reloaded from a saved file, which never writes an absent key as `null`/`undefined` in the first place. Exported for `cross-floor-hub-link-writer.ts`/`pruneInvalidCrossFloorLinks` below. */
export function clearTrunk(hub: Hub, alsoLink = false): Hub {
  if (hub.trunk === undefined && (!alsoLink || hub.link === undefined)) return hub
  const next = { ...hub }
  delete next.trunk
  if (alsoLink) delete next.link
  return next
}

/** `clearTrunk(hub, true)` - exported under its own name for `cross-floor-hub-link-writer.ts` (`unlinkHub`), which clears BOTH a hub's link and its (now meaningless) trunk. */
export const clearLinkAndTrunk = (hub: Hub): Hub => clearTrunk(hub, true)

/**
 * Validates a hub's OWN stored `link` against the actual floor list: wrong
 * direction, non-adjacent, a plain hub, a missing/wrong-kind partner, or a
 * partner that does not point back. `null` = valid, or `hub.link` unset.
 * Used by the loader and by `pruneInvalidCrossFloorLinks` - NOT by the
 * picker, which only ever offers already-valid candidates
 * (`listLinkCandidates`).
 */
export function crossFloorLinkProblem(floors: readonly Floor[], floorIndex: number, hub: Hub): string | null {
  if (!hub.link) return null
  if (hub.kind !== 'riser' && hub.kind !== 'drop') return 'is a plain hub and cannot be linked'

  const partnerFloorIndex = hub.kind === 'riser' ? floorIndex + 1 : floorIndex - 1
  const partnerFloor = floors[partnerFloorIndex]
  const directionNoun = hub.kind === 'riser' ? 'the floor above' : 'the floor below'
  if (!partnerFloor || partnerFloor.id !== hub.link.floorId) return `must link to ${directionNoun}`

  const wantedKind = hub.kind === 'riser' ? 'drop' : 'riser'
  const partnerHub = partnerFloor.hubs.find((candidate) => candidate.id === hub.link!.hubId)
  if (!partnerHub) return 'links to a point that no longer exists'
  if (partnerHub.kind !== wantedKind) return `links to a point that is not a ${wantedKind}`

  const floor = floors[floorIndex]
  if (!partnerHub.link || partnerHub.link.floorId !== floor.id || partnerHub.link.hubId !== hub.id) {
    return 'is not linked back by its partner'
  }
  return null
}

/**
 * Validates a hub's OWN stored `trunk`, targeting a different hub that
 * exists on the SAME floor. `null` = valid, or `hub.trunk` unset. Only a
 * validly linked riser / drop may carry one. A shaft opening never does -
 * each cable owns its route beyond a shaft (`Cable.beyondShaft`) - and is
 * never a valid trunk TARGET either: cables enter shafts, routes leave them.
 */
export function crossFloorTrunkProblem(floors: readonly Floor[], floorIndex: number, hub: Hub): string | null {
  if (!hub.trunk) return null
  if (hub.trunk.hubId === hub.id) return 'routes to itself'
  if (hub.kind === 'shaft') return 'is a shaft opening, which carries no route of its own'
  if (crossFloorLinkProblem(floors, floorIndex, hub) !== null || !hub.link) return 'has a route but is not validly linked'
  const target = floors[floorIndex].hubs.find((candidate) => candidate.id === hub.trunk!.hubId)
  if (!target) return 'routes to a point that no longer exists'
  if (target.kind === 'shaft') return 'routes to a shaft marker, which can never be a trunk target'
  return null
}

/** Candidates for `hub`'s link picker: opposite-kind points on the ONE legal adjacent floor, including `hub`'s current partner (if any) so a re-select of the same point still shows up. Empty for a plain hub, at the top/bottom floor for its kind, or an adjacent floor with no point of the right kind. */
export function listLinkCandidates(
  floors: readonly Floor[],
  floorIndex: number,
  hub: Hub,
): Array<{ floorId: string; hubId: string; label: string }> {
  if (hub.kind !== 'riser' && hub.kind !== 'drop') return []
  const partnerFloorIndex = hub.kind === 'riser' ? floorIndex + 1 : floorIndex - 1
  const partnerFloor = floors[partnerFloorIndex]
  if (!partnerFloor) return []
  const wantedKind = hub.kind === 'riser' ? 'drop' : 'riser'
  const floor = floors[floorIndex]
  const labels = hubLabels(partnerFloor.hubs)

  return partnerFloor.hubs
    .map((candidate, i) => ({ candidate, label: labels[i] }))
    .filter(
      ({ candidate }) =>
        candidate.kind === wantedKind &&
        (!candidate.link || (candidate.link.floorId === floor.id && candidate.link.hubId === hub.id)),
    )
    .map(({ candidate, label }) => ({ floorId: partnerFloor.id, hubId: candidate.id, label: `${partnerFloor.name} ${label}` }))
}

/**
 * Drops every hub's link/trunk that `crossFloorLinkProblem`/`crossFloorTrunkProblem`
 * reject, evaluated once against the ORIGINAL (unmodified) `floors` so the
 * result never depends on iteration order (a one-sided corrupt link is
 * detected from either side without needing the other side pruned first).
 * Returns the SAME `floors` reference when nothing needed pruning. Pushes
 * one warning per dropped link/trunk into `warnings` when given (the loader
 * wants them; the store's cascades do not). `shaftIds` (the project's
 * `shafts[]` ids, in order) is only for the warning text's own "T{n}" label -
 * omitted callers fall back to a per-floor count, wrong only when 2+ shafts
 * share one floor (review item M5).
 */
export function pruneInvalidCrossFloorLinks(floors: readonly Floor[], shaftIds?: readonly string[], warnings?: string[]): Floor[] {
  // Item 7 fix: name the floor + its R1/D1-style label, not the hub's raw (uuid) id - matches
  // `listLinkCandidates`'/the hub panel's own wording.
  const toClear: Array<{ ref: HubRef; trunkOnly: boolean; reason: string; label: string }> = []
  floors.forEach((floor, floorIndex) => {
    const labels = hubLabels(floor.hubs, shaftIds)
    floor.hubs.forEach((hub, hubIndex) => {
      const label = `${floor.name} ${labels[hubIndex]}`
      const linkProblem = crossFloorLinkProblem(floors, floorIndex, hub)
      if (linkProblem) {
        toClear.push({ ref: { floorId: floor.id, hubId: hub.id }, trunkOnly: false, reason: linkProblem, label })
        return
      }
      const trunkProblem = crossFloorTrunkProblem(floors, floorIndex, hub)
      if (trunkProblem) toClear.push({ ref: { floorId: floor.id, hubId: hub.id }, trunkOnly: true, reason: trunkProblem, label })
    })
  })
  if (toClear.length === 0) return floors as Floor[]

  let next = floors as Floor[]
  for (const item of toClear) {
    warnings?.push(`${item.label} ${item.reason}; ${item.trunkOnly ? 'route' : 'link'} dropped.`)
    next = updateHubInFloors(next, item.ref, (hub) => clearTrunk(hub, !item.trunkOnly))
  }
  return next
}
