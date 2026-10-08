import type { Hub, HubRef } from './cable-layout-types'
import { clearLinkAndTrunk, resolveHubRef, updateHubInFloors } from './cross-floor-hub-link-integrity'
import type { Floor } from '../floor/floor-types'

/**
 * The mutating half of cross-floor link/trunk handling - `unlinkHub`,
 * `linkHubPair`, `relinkHub`, `setHubTrunk`. Split out of
 * `cross-floor-hub-link-integrity.ts` (validation + prune) to keep that
 * file under 200 lines.
 */

/** `a`/`b` resolve, are two distinct hubs, and are an opposite-kind riser/drop pair on adjacent floors in the correct direction (riser below, drop above). Ownership (is either already linked elsewhere) is checked separately by the caller - this is shape/adjacency only. */
function isLegalPairShape(
  ra: { floorIndex: number; hub: Hub },
  rb: { floorIndex: number; hub: Hub },
  a: HubRef,
  b: HubRef,
): boolean {
  if (a.floorId === b.floorId && a.hubId === b.hubId) return false
  const [riser, riserFloorIndex, drop, dropFloorIndex] =
    ra.hub.kind === 'riser' ? [ra.hub, ra.floorIndex, rb.hub, rb.floorIndex] : [rb.hub, rb.floorIndex, ra.hub, ra.floorIndex]
  if (riser.kind !== 'riser' || drop.kind !== 'drop') return false
  return dropFloorIndex === riserFloorIndex + 1
}

function isLinkedTo(hub: Hub, ref: HubRef): boolean {
  return hub.link?.floorId === ref.floorId && hub.link?.hubId === ref.hubId
}

/** Clears `ref`'s link (and its own trunk - a trunk only makes sense while linked) and its CURRENT partner's link + trunk, symmetrically. Same array when `ref` doesn't resolve or isn't linked. */
export function unlinkHub(floors: readonly Floor[], ref: HubRef): Floor[] {
  const resolved = resolveHubRef(floors, ref)
  if (!resolved?.hub.link) return floors as Floor[]
  const partnerRef = resolved.hub.link
  const next = updateHubInFloors(floors, ref, clearLinkAndTrunk)
  return updateHubInFloors(next, partnerRef, clearLinkAndTrunk)
}

/**
 * Links `a` and `b` (whichever is the riser / whichever is the drop). No-op
 * (same `floors` reference, trunks untouched) when: either ref doesn't
 * resolve; they are already linked to each other; EITHER side is already
 * linked to a THIRD point (never "steals" - the same rule the loader
 * (`crossFloorLinkProblem`) and the picker (`listLinkCandidates`, which
 * never offers such a candidate in the first place) already enforce); or
 * the pair is not a legal adjacent riser-below/drop-above pair. To switch
 * an already-linked hub to a DIFFERENT partner in one step, use `relinkHub`.
 */
export function linkHubPair(floors: readonly Floor[], a: HubRef, b: HubRef): Floor[] {
  const ra = resolveHubRef(floors, a)
  const rb = resolveHubRef(floors, b)
  if (!ra || !rb) return floors as Floor[]
  if (isLinkedTo(ra.hub, b)) return floors as Floor[] // already linked to each other
  if (ra.hub.link || rb.hub.link) return floors as Floor[] // either side already linked elsewhere - rejected, not stolen
  if (!isLegalPairShape(ra, rb, a, b)) return floors as Floor[]
  const linked = updateHubInFloors(floors, a, (hub) => ({ ...hub, link: { floorId: b.floorId, hubId: b.hubId } }))
  return updateHubInFloors(linked, b, (hub) => ({ ...hub, link: { floorId: a.floorId, hubId: a.hubId } }))
}

/**
 * Re-links `ref` to `newPartner` (or, with `newPartner: null`, just
 * unlinks) in ONE pass - the hub panel's "Linked to" picker's own write, so
 * switching partners is one undo step: `ref`'s OLD partner (if any) is
 * unlinked first (that partner's own link + trunk, and `ref`'s own trunk -
 * its meaning changed too), THEN `ref` is linked to `newPartner` via the
 * same rule `linkHubPair` enforces (refuses if `newPartner` turns out to
 * already be linked to someone else - the UI's own candidate list should
 * never offer such a choice, but this stays safe if it ever did). No-op
 * when `ref` doesn't resolve or is already in the requested state.
 */
export function relinkHub(floors: readonly Floor[], ref: HubRef, newPartner: HubRef | null): Floor[] {
  const resolved = resolveHubRef(floors, ref)
  if (!resolved) return floors as Floor[]
  const currentLink = resolved.hub.link
  if (newPartner === null) return currentLink ? unlinkHub(floors, ref) : (floors as Floor[])
  if (currentLink && isLinkedTo(resolved.hub, newPartner)) return floors as Floor[]
  const unlinked = currentLink ? unlinkHub(floors, ref) : (floors as Floor[])
  return linkHubPair(unlinked, ref, newPartner)
}

/** Sets (or, with `trunk: null`, clears) `ref`'s own route to another hub on its own floor. No-op when `ref` doesn't resolve, isn't currently linked, or the target is itself / unknown. */
export function setHubTrunk(
  floors: readonly Floor[],
  ref: HubRef,
  trunk: { hubId: string; points: { x: number; y: number }[] } | null,
): Floor[] {
  const resolved = resolveHubRef(floors, ref)
  if (!resolved?.hub.link) return floors as Floor[]
  if (trunk === null) return updateHubInFloors(floors, ref, (hub) => (hub.trunk === undefined ? hub : { ...hub, trunk: undefined }))
  if (trunk.hubId === ref.hubId) return floors as Floor[]
  const targetExists = floors[resolved.floorIndex].hubs.some((candidate) => candidate.id === trunk.hubId)
  if (!targetExists) return floors as Floor[]
  return updateHubInFloors(floors, ref, (hub) => ({ ...hub, trunk }))
}
