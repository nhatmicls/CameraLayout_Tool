import type { Floor } from '../floor/floor-types'
import type { Cable, Hub, HubRef } from './cable-layout-types'

/**
 * The ONE place that knows where a cable ending on a linked riser/drop
 * leads next. Pair model (this phase): the exit is the partner hub, but
 * only once the partner carries a drawn `trunk` - otherwise the point
 * stays in typed mode (today's behaviour, unchanged). Shaft (phase 6) adds
 * a second case here, keyed by the cable's own `exitFloorId` choice - the
 * `cable` parameter is unused until then (optional - a query with no
 * particular cable in view, e.g. the hub panel's own mode summary, may
 * omit it); kept in the signature so that phase does not need to touch
 * every call site.
 */
export function resolveCrossFloorExit(
  floors: readonly Floor[],
  ref: HubRef,
  _cable?: Cable,
): { floorIndex: number; hub: Hub } | null {
  void _cable // unused until phase 6 (shaft exit choice) - kept in the signature so that phase touches no call site
  const floorIndex = floors.findIndex((floor) => floor.id === ref.floorId)
  if (floorIndex === -1) return null
  const hub = floors[floorIndex].hubs.find((candidate) => candidate.id === ref.hubId)
  if (!hub?.link) return null

  const partnerFloorIndex = floors.findIndex((floor) => floor.id === hub.link!.floorId)
  if (partnerFloorIndex === -1) return null
  const partner = floors[partnerFloorIndex].hubs.find((candidate) => candidate.id === hub.link!.hubId)
  if (!partner?.trunk) return null

  return { floorIndex: partnerFloorIndex, hub: partner }
}
