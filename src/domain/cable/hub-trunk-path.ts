import type { CablePoint, Hub } from './cable-layout-types'

/**
 * The full path of a hub's own drawn route to another hub on its own floor
 * (`Hub.trunk`): `[hub, ...trunk.points, target]`, same convention as
 * `resolveCablePathPx` for a cable. Shared by the trunk line, the vertex
 * editor and `cross-floor-hub-beyond-length-resolver.ts`'s horizontal-length
 * calculation - the one place that builds this polyline.
 *
 * `null` when `hub` has no trunk, or when its target hub no longer exists
 * (should not happen on a live project - `pruneInvalidCrossFloorLinks`
 * clears a trunk whose target is gone - but a defensive guard costs nothing).
 */
export function resolveHubTrunkPathPx(hub: Hub, hubs: readonly Hub[]): CablePoint[] | null {
  if (!hub.trunk) return null
  const target = hubs.find((candidate) => candidate.id === hub.trunk!.hubId)
  if (!target) return null
  return [{ x: hub.x, y: hub.y }, ...hub.trunk.points, { x: target.x, y: target.y }]
}
