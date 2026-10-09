import type { Cable, CableShaftLeg, Hub } from './cable-layout-types'

/**
 * Load-time conversion of the pre-v9 SHARED shaft exits to one route per
 * cable. Before schema v9 a shaft opening could carry a `trunk` (an exit
 * route to a hub on its floor) shared by every cable using that exit, and a
 * cable named its exit with `exitFloorId` when the shaft had several. From
 * v9 each cable owns its route (`Cable.beyondShaft`), so on load:
 *
 * - every cable ending on a shaft opening that resolved to an exit under the
 *   OLD rule (exactly one exit = that one; several = the one `exitFloorId`
 *   names) gets a copy of that exit's route as its own leg - same floor,
 *   same points, same target hub, so its length is unchanged;
 * - a cable that resolved to no exit (none drawn, or several and none
 *   chosen) gets no leg - it reads "not routed";
 * - `trunk` is removed from every shaft opening and `exitFloorId` from every
 *   cable. A cable that already has a leg keeps it.
 *
 * Runs on the RAW floors, before any reference is validated: a copied leg
 * that turns out invalid is cleared later by `pruneInvalidShaftLegs`. An
 * exit whose route did not lead to a plain hub / riser / drop of its own
 * floor never counted as an exit (the old loader dropped it first), so it is
 * skipped here too.
 *
 * `unchosenCableCount` = cables of a shaft that HAD exits but resolved to
 * none: they used to be left out of the totals and now count up to the shaft.
 */

type LegacyCable = Cable & { exitFloorId?: string }

interface LegacyFloor {
  id: string
  hubs?: Hub[]
  cables?: LegacyCable[]
}

export function migrateSharedShaftExitsToCableLegs<F extends LegacyFloor>(
  floors: readonly F[],
): { floors: F[]; convertedCableCount: number; unchosenCableCount: number } {
  // The exits of each shaft under the old rule: its first opening per floor, in floor order, that carries a trunk.
  const exitsByShaftId = new Map<string, Array<{ floorId: string; trunk: NonNullable<Hub['trunk']> }>>()
  for (const floor of floors) {
    const seenShaftIds = new Set<string>()
    for (const hub of floor.hubs ?? []) {
      if (hub.kind !== 'shaft' || !hub.shaftId || seenShaftIds.has(hub.shaftId)) continue
      seenShaftIds.add(hub.shaftId)
      const trunk = hub.trunk
      if (!trunk) continue
      const target = (floor.hubs ?? []).find((candidate) => candidate.id === trunk.hubId)
      if (!target || target.kind === 'shaft' || target.id === hub.id) continue
      const exits = exitsByShaftId.get(hub.shaftId) ?? []
      exits.push({ floorId: floor.id, trunk })
      exitsByShaftId.set(hub.shaftId, exits)
    }
  }

  let convertedCableCount = 0
  let unchosenCableCount = 0
  const next = floors.map((floor) => {
    const shaftIdByHubId = new Map<string, string>()
    for (const hub of floor.hubs ?? []) {
      if (hub.kind === 'shaft' && hub.shaftId && !shaftIdByHubId.has(hub.id)) shaftIdByHubId.set(hub.id, hub.shaftId)
    }

    const cables = floor.cables?.map((legacy): Cable => {
      const { exitFloorId, ...cable } = legacy
      const shaftId = cable.hubId === undefined ? undefined : shaftIdByHubId.get(cable.hubId)
      if (cable.beyondShaft || shaftId === undefined) return cable
      const exits = exitsByShaftId.get(shaftId) ?? []
      const exit = exits.length === 1 ? exits[0] : exits.find((candidate) => candidate.floorId === exitFloorId)
      if (!exit) {
        if (exits.length > 0) unchosenCableCount += 1
        return cable
      }
      convertedCableCount += 1
      const beyondShaft: CableShaftLeg = { floorId: exit.floorId, points: exit.trunk.points, hubId: exit.trunk.hubId }
      return { ...cable, beyondShaft }
    })

    const hubs = floor.hubs?.map((hub) => {
      if (hub.kind !== 'shaft' || hub.trunk === undefined) return hub
      const cleared = { ...hub }
      delete cleared.trunk
      return cleared
    })

    return { ...floor, ...(hubs ? { hubs } : {}), ...(cables ? { cables } : {}) }
  })
  return { floors: next, convertedCableCount, unchosenCableCount }
}
