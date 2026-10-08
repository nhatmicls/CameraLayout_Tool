import type { Floor } from '../floor/floor-types'
import { resolveShaftCableExit } from './shaft-integrity'
import type { Cable, Hub, HubRef } from './cable-layout-types'

/**
 * The ONE place that knows where a cable ending on a linked riser/drop OR a
 * shaft marker leads next.
 *
 * - `{ kind: 'none' }`: no exit exists at all - the point stays in typed
 *   mode (pair: unlinked, or the partner has no trunk yet; shaft: no
 *   marker anywhere has a trunk).
 * - `{ kind: 'exit', floorIndex, hub }`: the one place beyond this point -
 *   pair: the partner hub (only once it carries a drawn `trunk`). Shaft:
 *   the exit this CABLE uses - implicit with exactly one exit, or the one
 *   `cable.exitFloorId` names among several.
 * - `{ kind: 'not-chosen' }`: shaft only - several exits exist and `cable`
 *   named none of them (or a stale one) - never guessed, excluded from the
 *   estimate upstream.
 */
export type CrossFloorExitResolution = { kind: 'none' } | { kind: 'exit'; floorIndex: number; hub: Hub } | { kind: 'not-chosen' }

export function resolveCrossFloorExit(floors: readonly Floor[], ref: HubRef, cable?: Cable): CrossFloorExitResolution {
  const floorIndex = floors.findIndex((floor) => floor.id === ref.floorId)
  if (floorIndex === -1) return { kind: 'none' }
  const hub = floors[floorIndex].hubs.find((candidate) => candidate.id === ref.hubId)
  if (!hub) return { kind: 'none' }

  if (hub.kind === 'shaft' && hub.shaftId) {
    const resolved = resolveShaftCableExit(floors, hub.shaftId, cable)
    if ('problem' in resolved) return resolved.problem === 'no-exit' ? { kind: 'none' } : { kind: 'not-chosen' }
    return { kind: 'exit', floorIndex: resolved.exit.floorIndex, hub: resolved.exit.hub }
  }

  if (!hub.link) return { kind: 'none' }
  const partnerFloorIndex = floors.findIndex((floor) => floor.id === hub.link!.floorId)
  if (partnerFloorIndex === -1) return { kind: 'none' }
  const partner = floors[partnerFloorIndex].hubs.find((candidate) => candidate.id === hub.link!.hubId)
  if (!partner?.trunk) return { kind: 'none' }

  return { kind: 'exit', floorIndex: partnerFloorIndex, hub: partner }
}
