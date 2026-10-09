import type { Floor } from '../floor/floor-types'
import type { Hub, HubRef } from './cable-layout-types'

/**
 * The ONE place that knows where a cable ending on a linked riser / drop
 * leads next.
 *
 * - `{ kind: 'none' }`: no route beyond this point - it stays in typed mode
 *   (unlinked, or the partner has no trunk yet).
 * - `{ kind: 'exit', floorIndex, hub }`: the partner hub, once it carries a
 *   drawn `trunk`.
 *
 * A shaft opening is never resolved here: a cable through a shaft owns its
 * route beyond it (`Cable.beyondShaft`, `shaft-cable-leg.ts`), so there is no
 * shared exit to look up - this returns `none` for one.
 */
export type CrossFloorExitResolution = { kind: 'none' } | { kind: 'exit'; floorIndex: number; hub: Hub }

export function resolveCrossFloorExit(floors: readonly Floor[], ref: HubRef): CrossFloorExitResolution {
  const floorIndex = floors.findIndex((floor) => floor.id === ref.floorId)
  if (floorIndex === -1) return { kind: 'none' }
  const hub = floors[floorIndex].hubs.find((candidate) => candidate.id === ref.hubId)
  if (!hub?.link) return { kind: 'none' }

  const partnerFloorIndex = floors.findIndex((floor) => floor.id === hub.link!.floorId)
  if (partnerFloorIndex === -1) return { kind: 'none' }
  const partner = floors[partnerFloorIndex].hubs.find((candidate) => candidate.id === hub.link!.hubId)
  if (!partner?.trunk) return { kind: 'none' }

  return { kind: 'exit', floorIndex: partnerFloorIndex, hub: partner }
}
