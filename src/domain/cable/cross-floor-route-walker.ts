import type { Floor } from '../floor/floor-types'
import { resolveCableEnd, type CableDeviceEndpoint } from './cable-endpoint-index'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { resolveHubTrunkPathPx } from './hub-trunk-path'
import { buildFloorCableEndpointIndex, resolveShaftLeg, type ResolvedShaftLeg, type ShaftLegLookups } from './shaft-cable-leg'
import type { Cable, CablePoint, Hub } from './cable-layout-types'

/**
 * The ONE topology walk every cross-floor chain follows: a riser / drop
 * pair's trunk AND a cable's own leg beyond a shaft, folded together - no
 * second walker. Pure topology, no metres: `cross-floor-hub-beyond-length-resolver.ts`
 * folds metres over this result; `cable-end-to-end-label.ts` reads its final
 * end for the project's cable labels.
 */

export type CrossFloorRouteHop =
  | { kind: 'pair'; fromFloorIndex: number; exitFloorIndex: number; exitHub: Hub; targetHub: Hub; pathPx: CablePoint[] }
  | { kind: 'shaft-leg'; fromFloorIndex: number; exitFloorIndex: number; leg: ResolvedShaftLeg }

export type CrossFloorRouteEnd =
  | { kind: 'hub'; floorIndex: number; hub: Hub }
  | { kind: 'device'; floorIndex: number; device: CableDeviceEndpoint }
  | { kind: 'cycle'; floorIndex: number }
  /** A pair exit without a resolvable trunk / target hub - defensive only: store pruning keeps every trunk's target resolvable on a live project. */
  | { kind: 'broken'; floorIndex: number }
  /** The cable's own end (its hub or its `endDevice`) no longer exists. */
  | { kind: 'missing' }

export interface CrossFloorRoute {
  hops: CrossFloorRouteHop[]
  end: CrossFloorRouteEnd
}

/**
 * Walks from `(floorIndex, hub)` until it reaches a final hub, a device
 * (only possible through the ONE shaft leg a cable may own), a cycle, or a
 * defensive "broken" dead end. `cableInView` is consulted ONLY while it is
 * still the caller's original cable (the very first hub visited) - a shaft
 * opening met on any later hop has no specific cable to resolve a leg for,
 * so it reads as "not routed" (a `hub` end), exactly like
 * `walkCrossFloorRouteFromHub`'s own no-cable contract. A legal chain visits
 * each `(floor, hub)` at most once, so the visited set alone terminates the
 * loop - no depth limit needed.
 */
function walkHubChain(
  floors: readonly Floor[],
  floorIndex: number,
  hub: Hub,
  cableForFirstStep: Cable | undefined,
  lookups: ShaftLegLookups | undefined,
): CrossFloorRoute {
  const hops: CrossFloorRouteHop[] = []
  const visited = new Set<string>()
  let curFloorIndex = floorIndex
  let curHub = hub
  let cableInView = cableForFirstStep

  for (;;) {
    const floor = floors[curFloorIndex]
    const key = `${floor.id}\u0000${curHub.id}`
    if (visited.has(key)) return { hops, end: { kind: 'cycle', floorIndex: curFloorIndex } }
    visited.add(key)

    if (curHub.kind === 'shaft') {
      const leg = cableInView ? resolveShaftLeg(floors, curFloorIndex, cableInView, lookups) : null
      if (!leg) return { hops, end: { kind: 'hub', floorIndex: curFloorIndex, hub: curHub } }
      hops.push({ kind: 'shaft-leg', fromFloorIndex: curFloorIndex, exitFloorIndex: leg.exitFloorIndex, leg })
      // Narrowed into a local: TS does not carry a property-access narrowing (`leg.end.kind`) into
      // the `find` callback below, only a plain identifier's.
      const legEnd = leg.end
      if (legEnd.kind === 'device') return { hops, end: { kind: 'device', floorIndex: leg.exitFloorIndex, device: legEnd.device } }

      const exitFloor = floors[leg.exitFloorIndex]
      const nextHub = exitFloor.hubs.find((candidate) => candidate.id === legEnd.hub.hubId)
      if (!nextHub) return { hops, end: { kind: 'broken', floorIndex: leg.exitFloorIndex } }
      curFloorIndex = leg.exitFloorIndex
      curHub = nextHub
      cableInView = undefined
      continue
    }

    const exit = resolveCrossFloorExit(floors, { floorId: floor.id, hubId: curHub.id })
    if (exit.kind === 'none') return { hops, end: { kind: 'hub', floorIndex: curFloorIndex, hub: curHub } }

    const qFloor = floors[exit.floorIndex]
    const partnerHub = exit.hub
    const trunk = partnerHub.trunk
    const targetHub = trunk ? qFloor.hubs.find((candidate) => candidate.id === trunk.hubId) : undefined
    const trunkPath = trunk ? resolveHubTrunkPathPx(partnerHub, qFloor.hubs) : null
    if (!trunk || !targetHub || !trunkPath) return { hops, end: { kind: 'broken', floorIndex: exit.floorIndex } }

    hops.push({ kind: 'pair', fromFloorIndex: curFloorIndex, exitFloorIndex: exit.floorIndex, exitHub: partnerHub, targetHub, pathPx: trunkPath })
    curFloorIndex = exit.floorIndex
    curHub = targetHub
    cableInView = undefined
  }
}

/**
 * A cable ending on a device (`cable.endDevice`, same floor, no hops) or on
 * a hub - walks any pair / shaft-leg chain beyond the hub. `missing` when
 * the cable's own end no longer exists.
 */
export function walkCrossFloorRoute(floors: readonly Floor[], sourceFloorIndex: number, cable: Cable, lookups?: ShaftLegLookups): CrossFloorRoute {
  const sourceFloor = floors[sourceFloorIndex]
  if (!sourceFloor) return { hops: [], end: { kind: 'missing' } }

  if (cable.endDevice) {
    const end = resolveCableEnd({ endDevice: cable.endDevice }, buildFloorCableEndpointIndex(sourceFloor, lookups))
    return { hops: [], end: end?.kind === 'device' ? { kind: 'device', floorIndex: sourceFloorIndex, device: end.device } : { kind: 'missing' } }
  }

  const hub = cable.hubId === undefined ? undefined : sourceFloor.hubs.find((candidate) => candidate.id === cable.hubId)
  if (!hub) return { hops: [], end: { kind: 'missing' } }
  return walkHubChain(floors, sourceFloorIndex, hub, cable, lookups)
}

/** Hub-only entry (no cable in view) for `resolveHubBeyondLength`'s panel query. */
export function walkCrossFloorRouteFromHub(floors: readonly Floor[], floorIndex: number, hub: Hub): CrossFloorRoute {
  return walkHubChain(floors, floorIndex, hub, undefined, undefined)
}
