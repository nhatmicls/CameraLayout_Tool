import { clampPointToImageBounds } from '../shared/clamp'
import { MAX_HUBS, type Hub, type HubRef } from './cable-layout-types'
import { resolveHubRef, updateHubInFloors } from './cross-floor-hub-link-integrity'
import type { Floor } from '../floor/floor-types'

/**
 * "Create paired point": one click creates the opposite-kind riser/drop on
 * the ONE legal adjacent floor and links both sides, removing the
 * round trip of switching floors and placing the matching point by hand.
 * Split out of `cross-floor-hub-link-integrity.ts` to keep that file under
 * 200 lines - this is its own, separate concern (creation, not validation
 * of an existing link), reusing that file's `resolveHubRef`/`updateHubInFloors`.
 */

/**
 * Shared by `createPairedHub` and the hub panel's own disabled-button check
 * (`pairedHubRefusalReason`) so the two can never disagree: null = allowed,
 * with the resolved refusal-free context the caller needs next.
 */
function checkCreatePairedHub(
  floors: readonly Floor[],
  ref: HubRef,
): { floorIndex: number; hub: Hub; pairedKind: 'riser' | 'drop'; partnerFloorIndex: number; partnerFloor: Floor } | { problem: string } {
  const resolved = resolveHubRef(floors, ref)
  if (!resolved) return { problem: 'That point no longer exists.' }
  const { floorIndex, hub } = resolved
  if (hub.kind !== 'riser' && hub.kind !== 'drop') return { problem: 'Only a riser or drop can be paired.' }
  if (hub.link) return { problem: 'Already linked.' }

  const pairedKind = hub.kind === 'riser' ? 'drop' : 'riser'
  const partnerFloorIndex = hub.kind === 'riser' ? floorIndex + 1 : floorIndex - 1
  const partnerFloor = floors[partnerFloorIndex]
  if (!partnerFloor) return { problem: hub.kind === 'riser' ? 'There is no floor above.' : 'There is no floor below.' }
  if (!partnerFloor.image) return { problem: `${partnerFloor.name} has no plan image yet.` }
  if (partnerFloor.hubs.length >= MAX_HUBS) return { problem: `${partnerFloor.name} already has the maximum of ${MAX_HUBS} hubs.` }
  return { floorIndex, hub, pairedKind, partnerFloorIndex, partnerFloor }
}

/** The hub panel's "Create paired point" button: null = allowed, else the reason to show disabled. Same rule set `createPairedHub` itself enforces. */
export function pairedHubRefusalReason(floors: readonly Floor[], ref: HubRef): string | null {
  const result = checkCreatePairedHub(floors, ref)
  return 'problem' in result ? result.problem : null
}

/**
 * Creates the opposite-kind point on the ONE legal adjacent floor at
 * `ref`'s own position (clamped to that floor's image) and links both
 * sides. `riserDefaultMountHeightM` mirrors the manual "Add riser" tool's
 * own default (`cableSettings.routeHeightM`) - a drop's default is always
 * 0, the same fixed convention the manual tool uses.
 */
export function createPairedHub(
  floors: readonly Floor[],
  ref: HubRef,
  newHubId: string,
  riserDefaultMountHeightM: number,
): { floors: Floor[] } | { problem: string } {
  const checked = checkCreatePairedHub(floors, ref)
  if ('problem' in checked) return checked
  const { floorIndex, hub, pairedKind, partnerFloorIndex, partnerFloor } = checked

  const floor = floors[floorIndex]
  const { x, y } = clampPointToImageBounds({ x: hub.x, y: hub.y }, partnerFloor.image!.widthPx, partnerFloor.image!.heightPx)
  const pairedHub: Hub = {
    id: newHubId,
    kind: pairedKind,
    x,
    y,
    mountHeightM: pairedKind === 'drop' ? 0 : riserDefaultMountHeightM,
    link: { floorId: floor.id, hubId: hub.id },
  }

  const withPairedHub = floors.map((f, i) => (i === partnerFloorIndex ? { ...f, hubs: [...f.hubs, pairedHub] } : f))
  const linked = updateHubInFloors(withPairedHub, ref, (h) => ({ ...h, link: { floorId: partnerFloor.id, hubId: newHubId } }))
  return { floors: linked }
}
