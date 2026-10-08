import type { Floor } from '../floor/floor-types'
import type { Project } from '../project-file/project-types'
import { planPxToMeters } from '../shared/scale-calibration-calculator'
import { hubLabels } from './cable-endpoint-index'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { resolveHubTrunkPathPx } from './hub-trunk-path'
import { computeScaleUncertainty, polylineLengthPx, sumMetersIntervals, type MetersInterval } from './cable-length-estimate-calculator'
import { hubEffectiveHeightM, type Cable, type Hub, type HubRef } from './cable-layout-types'

/**
 * What a cable finds "beyond" the hub it ends on, in metres - the direct
 * replacement for today's flat `hubDropM + hubExtraM`. `typed` is exactly
 * today's formula (unlinked, or the partner has no trunk - byte-identical).
 * `route` is the pair's computed mode: vertical from `floorHeightM`, plus
 * the trunk's own horizontal interval (that floor's scale), plus whatever
 * is beyond the trunk's target hub (recursive - a plain hub ends it, a
 * further linked point continues it). `unavailable` means the chain hit a
 * floor with no scale, or a cycle (crafted/corrupt file) - never silently 0.
 */
export type HubBeyondLength =
  | { source: 'typed'; run: MetersInterval }
  | { source: 'route'; crossingVerticalM: number; run: MetersInterval; viaLabel: string }
  | { source: 'unavailable'; reason: 'linked-floor-scale-not-set' | 'link-cycle'; floorName: string }

/** Sum of every floor's `floorHeightM` strictly between `fromIndex` and `toIndex` (order-independent). 0 when they are equal - adjacent floors therefore contribute exactly ONE floor height. */
export function sumFloorHeightsBetween(floors: readonly Floor[], fromIndex: number, toIndex: number): number {
  if (fromIndex === toIndex) return 0
  const lo = Math.min(fromIndex, toIndex)
  const hi = Math.max(fromIndex, toIndex)
  let sum = 0
  for (let i = lo; i < hi; i++) sum += floors[i].floorHeightM
  return sum
}

/** Today's formula, unchanged: `|routeHeightM - hubEffectiveHeightM(hub)| + extraLengthM`. Flat (min === max === nominal) - no scale uncertainty touches a typed value. */
function typedBeyond(routeHeightM: number, hub: Pick<Hub, 'kind' | 'mountHeightM' | 'extraLengthM'>): HubBeyondLength {
  const flat = Math.abs(routeHeightM - hubEffectiveHeightM(hub)) + (hub.extraLengthM ?? 0)
  return { source: 'typed', run: { nominal: flat, min: flat, max: flat } }
}

function resolveBeyond(
  project: Project,
  floorIndex: number,
  hub: Hub,
  cable: Cable | undefined,
  visited: ReadonlySet<string>,
  depth: number,
  maxDepth: number,
): HubBeyondLength {
  const floor = project.floors[floorIndex]
  const key = `${floor.id}\u0000${hub.id}`
  // The visited set is the REAL cycle test: a genuine cycle always revisits a (floor, hub) key,
  // so it is always caught here regardless of how many floors/hubs the project has. `depth >
  // maxDepth` is a pure backstop against a bug in the visited-set bookkeeping itself - `maxDepth`
  // is the total number of hubs in the project, so a LEGAL chain (every hop visits a hub it has
  // never visited before) can never exceed it; only an actual revisit (already caught above) or a
  // defect could. Must NOT be floor-count-based: a legal chain can zig-zag between the same two
  // floors many times over, using a different hub pair each time.
  if (visited.has(key)) {
    return { source: 'unavailable', reason: 'link-cycle', floorName: floor.name }
  }
  if (depth > maxDepth) {
    return { source: 'unavailable', reason: 'link-cycle', floorName: floor.name }
  }

  const exit = resolveCrossFloorExit(project.floors, { floorId: floor.id, hubId: hub.id }, cable)
  if (!exit) return typedBeyond(project.cableSettings.routeHeightM, hub)

  const qFloor = project.floors[exit.floorIndex]
  const partnerHub = exit.hub
  // The lower floor of the pair is always the riser's own floor (a drop always links to the riser BELOW it).
  const riserFloorIndex = hub.kind === 'riser' ? floorIndex : exit.floorIndex
  const crossingVerticalM = sumFloorHeightsBetween(project.floors, riserFloorIndex, riserFloorIndex + 1)

  if (!qFloor.scale) return { source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: qFloor.name }

  const trunk = partnerHub.trunk
  // Pruning keeps this resolvable; defensive fallback only (should not happen on a live project).
  const targetHub = trunk ? qFloor.hubs.find((candidate) => candidate.id === trunk.hubId) : undefined
  const trunkPath = trunk ? resolveHubTrunkPathPx(partnerHub, qFloor.hubs) : null
  if (!trunk || !targetHub || !trunkPath) return typedBeyond(project.cableSettings.routeHeightM, hub)

  const horizPx = polylineLengthPx(trunkPath)
  const horizM = planPxToMeters(horizPx, qFloor.scale.planPxPerMeter)
  const uncertainty = computeScaleUncertainty(qFloor.scale, project.cableSettings.clickErrorPx)
  const horizInterval: MetersInterval = {
    nominal: horizM,
    min: uncertainty.minFactor === null ? null : horizM * uncertainty.minFactor,
    max: uncertainty.maxFactor === null ? null : horizM * uncertainty.maxFactor,
  }

  const nextVisited = new Set(visited)
  nextVisited.add(key)
  const targetBeyond = resolveBeyond(project, exit.floorIndex, targetHub, cable, nextVisited, depth + 1, maxDepth)
  if (targetBeyond.source === 'unavailable') return targetBeyond

  const crossingInterval: MetersInterval = { nominal: crossingVerticalM, min: crossingVerticalM, max: crossingVerticalM }
  const run = sumMetersIntervals([crossingInterval, horizInterval, targetBeyond.run])
  const partnerLabel = hubLabels(qFloor.hubs)[qFloor.hubs.findIndex((candidate) => candidate.id === partnerHub.id)]
  return { source: 'route', crossingVerticalM, run, viaLabel: `${qFloor.name} ${partnerLabel}` }
}

/**
 * The beyond-length contribution for ONE point, independent of any
 * particular cable (the hub panel's "what mode is this point in" query).
 * `cable` is forwarded to `resolveCrossFloorExit` (unused until phase 6's
 * shaft exit choice) - omit it when there is no specific cable in view.
 */
export function resolveHubBeyondLength(project: Project, ref: HubRef, cable?: Cable): HubBeyondLength {
  const floorIndex = project.floors.findIndex((floor) => floor.id === ref.floorId)
  const hub = floorIndex === -1 ? undefined : project.floors[floorIndex].hubs.find((candidate) => candidate.id === ref.hubId)
  if (floorIndex === -1 || !hub) return typedBeyond(project.cableSettings.routeHeightM, { mountHeightM: 0 })
  // Total hub count across the whole project - a legal chain visits each hub at most once, so this
  // bound can never trip on one; see `resolveBeyond`'s own comment on the visited-set vs. this backstop.
  const maxDepth = project.floors.reduce((sum, floor) => sum + floor.hubs.length, 0)
  return resolveBeyond(project, floorIndex, hub, cable, new Set(), 0, maxDepth)
}

/**
 * Every floor's cables, each resolved to its `HubBeyondLength` - the input
 * `computeCableLayoutEstimate` needs per floor (`beyondByCableId`). Cached
 * per (floor, hub): every cable ending on the same hub shares one result in
 * this phase (the per-cable keying only starts to matter once a shaft lets
 * different cables choose different exits - phase 6).
 */
export function resolveCableBeyondLengths(project: Project): Map<string, Map<string, HubBeyondLength>> {
  const result = new Map<string, Map<string, HubBeyondLength>>()
  for (const floor of project.floors) {
    const cableMap = new Map<string, HubBeyondLength>()
    const cache = new Map<string, HubBeyondLength>()
    for (const cable of floor.cables) {
      const hub = floor.hubs.find((candidate) => candidate.id === cable.hubId)
      if (!hub) continue
      let beyond = cache.get(hub.id)
      if (!beyond) {
        beyond = resolveHubBeyondLength(project, { floorId: floor.id, hubId: hub.id }, cable)
        cache.set(hub.id, beyond)
      }
      cableMap.set(cable.id, beyond)
    }
    result.set(floor.id, cableMap)
  }
  return result
}
