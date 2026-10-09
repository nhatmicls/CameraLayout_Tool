import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { Floor } from '../floor/floor-types'
import type { Project } from '../project-file/project-types'
import { planPxToMeters } from '../shared/scale-calibration-calculator'
import { hubLabels } from './cable-endpoint-index'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { resolveHubTrunkPathPx } from './hub-trunk-path'
import { computeScaleUncertainty, polylineLengthPx, sumMetersIntervals, type MetersInterval } from './cable-length-estimate-calculator'
import { hubEffectiveHeightM, type Cable, type CablePoint, type Hub, type HubRef } from './cable-layout-types'
import { resolveShaftLeg, type ShaftLegLookups } from './shaft-cable-leg'

/**
 * What a cable finds "beyond" the hub it ends on, in metres.
 *
 * - `typed`: the hub's own typed values (a plain hub, an unlinked riser /
 *   drop, or a linked one whose partner has no trunk). `shaftNotRouted` = a
 *   shaft opening the cable is not routed beyond yet: 0 m at the opening +
 *   its typed `extraLengthM`.
 * - `route`: a measured continuation - vertical from `floorHeightM`, plus a
 *   route on the other floor at that floor's scale, plus whatever is beyond
 *   where it ends. Either a riser / drop pair's trunk (chains continue), or
 *   the cable's own leg beyond a shaft; `endLabel` / `endsOnDevice` are set
 *   for the shaft case only.
 * - `unavailable`: the route hit a floor with no scale or a cycle
 *   (crafted / corrupt file) - never silently 0. `endLabel` is set when a
 *   cable's own leg beyond a shaft was involved, so its warning still names
 *   it "C1-H1", not "C1-?".
 */
export type HubBeyondLength =
  | { source: 'typed'; run: MetersInterval; shaftNotRouted?: boolean }
  | { source: 'route'; crossingVerticalM: number; run: MetersInterval; viaLabel: string; endLabel?: string; endsOnDevice?: boolean }
  | { source: 'unavailable'; reason: 'linked-floor-scale-not-set' | 'link-cycle'; floorName: string; endLabel?: string }

/** Sum of every floor's `floorHeightM` strictly between `fromIndex` and `toIndex` (order-independent). 0 when they are equal - adjacent floors therefore contribute exactly ONE floor height. */
export function sumFloorHeightsBetween(floors: readonly Floor[], fromIndex: number, toIndex: number): number {
  if (fromIndex === toIndex) return 0
  const lo = Math.min(fromIndex, toIndex)
  const hi = Math.max(fromIndex, toIndex)
  let sum = 0
  for (let i = lo; i < hi; i++) sum += floors[i].floorHeightM
  return sum
}

const flat = (m: number): MetersInterval => ({ nominal: m, min: m, max: m })

/**
 * Riser / drop / plain hub: `|routeHeightM - hubEffectiveHeightM(hub)| + extraLengthM`.
 * Flat (min === max === nominal) - no scale uncertainty touches a typed value.
 *
 * Shaft opening (a cable not routed beyond it): 0 m AT the opening + its own
 * `extraLengthM`, no `routeHeightM` term - an opening's `mountHeightM` is
 * always 0 and carries no floor-crossing meaning, so the riser / drop formula
 * would add a spurious `routeHeightM`.
 */
function typedBeyond(routeHeightM: number, hub: Pick<Hub, 'kind' | 'mountHeightM' | 'extraLengthM'>): HubBeyondLength {
  if (hub.kind === 'shaft') {
    // `shaftNotRouted` tells `estimateCableLength` (which only sees a `CableHubEndpoint`) to use
    // `run` as-is instead of the riser / drop / plain-hub formula.
    return { source: 'typed', run: flat(hub.extraLengthM ?? 0), shaftNotRouted: true }
  }
  return { source: 'typed', run: flat(Math.abs(routeHeightM - hubEffectiveHeightM(hub)) + (hub.extraLengthM ?? 0)) }
}

/** A drawn route on `floor`, as metres with that floor's own scale-error range. `floor.scale` must be set. */
function routeInterval(project: Project, floor: Floor, pathPx: readonly CablePoint[]): MetersInterval {
  const scale = floor.scale!
  const horizM = planPxToMeters(polylineLengthPx(pathPx), scale.planPxPerMeter)
  const uncertainty = computeScaleUncertainty(scale, project.cableSettings.clickErrorPx)
  return {
    nominal: horizM,
    min: uncertainty.minFactor === null ? null : horizM * uncertainty.minFactor,
    max: uncertainty.maxFactor === null ? null : horizM * uncertainty.maxFactor,
  }
}

interface Walk {
  project: Project
  lookups: ShaftLegLookups
  maxDepth: number
}

function resolveBeyond(walk: Walk, floorIndex: number, hub: Hub, cable: Cable | undefined, visited: ReadonlySet<string>, depth: number): HubBeyondLength {
  const { project } = walk
  const floor = project.floors[floorIndex]
  const key = `${floor.id}\u0000${hub.id}`
  // The visited set is the REAL cycle test: a genuine cycle always revisits a (floor, hub) key.
  // `depth > maxDepth` is a pure backstop - `maxDepth` is the total number of hubs in the project,
  // so a LEGAL chain (every hop visits a hub it has never visited before) can never exceed it.
  // Must NOT be floor-count-based: a legal chain can zig-zag between the same two floors many
  // times over, using a different hub pair each time.
  if (visited.has(key) || depth > walk.maxDepth) {
    return { source: 'unavailable', reason: 'link-cycle', floorName: floor.name }
  }
  const nextVisited = new Set(visited)
  nextVisited.add(key)
  const { routeHeightM, defaultDeviceHeightM } = project.cableSettings

  if (hub.kind === 'shaft') {
    // Only the cable itself knows where it goes beyond a shaft. No cable in view (a route chain
    // never ends on an opening), or no leg yet = typed.
    const leg = cable ? resolveShaftLeg(project.floors, floorIndex, cable, walk.lookups) : null
    if (!leg) return typedBeyond(routeHeightM, hub)
    const exitFloor = project.floors[leg.exitFloorIndex]
    if (!exitFloor.scale) return { source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: exitFloor.name, endLabel: leg.end.label }

    const crossingVerticalM = sumFloorHeightsBetween(project.floors, floorIndex, leg.exitFloorIndex)
    let endRun: MetersInterval
    if (leg.end.kind === 'device') {
      endRun = flat(Math.abs(routeHeightM - (leg.end.device.mountHeightM ?? defaultDeviceHeightM)))
    } else {
      const endHubId = leg.end.hub.hubId
      const endHub = exitFloor.hubs.find((candidate) => candidate.id === endHubId)!
      const endBeyond = resolveBeyond(walk, leg.exitFloorIndex, endHub, undefined, nextVisited, depth + 1)
      if (endBeyond.source === 'unavailable') return { ...endBeyond, endLabel: leg.end.label }
      endRun = endBeyond.run
    }
    return {
      source: 'route',
      crossingVerticalM,
      run: sumMetersIntervals([flat(crossingVerticalM), routeInterval(project, exitFloor, leg.pathPx), endRun]),
      viaLabel: `${exitFloor.name} ${leg.end.label}`,
      endLabel: leg.end.label,
      endsOnDevice: leg.end.kind === 'device',
    }
  }

  const exit = resolveCrossFloorExit(project.floors, { floorId: floor.id, hubId: hub.id })
  if (exit.kind === 'none') return typedBeyond(routeHeightM, hub)

  const qFloor = project.floors[exit.floorIndex]
  const partnerHub = exit.hub
  const crossingVerticalM = sumFloorHeightsBetween(project.floors, floorIndex, exit.floorIndex)
  if (!qFloor.scale) return { source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: qFloor.name }

  const trunk = partnerHub.trunk
  const targetHub = trunk ? qFloor.hubs.find((candidate) => candidate.id === trunk.hubId) : undefined
  const trunkPath = trunk ? resolveHubTrunkPathPx(partnerHub, qFloor.hubs) : null
  // Pruning keeps every trunk's target resolvable, so this is unreachable on a live project - a
  // DEFENSIVE fallback only: "unavailable" is the honest answer for a state that should never
  // occur, never a number that looks complete.
  if (!trunk || !targetHub || !trunkPath) return { source: 'unavailable', reason: 'link-cycle', floorName: qFloor.name }

  const targetBeyond = resolveBeyond(walk, exit.floorIndex, targetHub, undefined, nextVisited, depth + 1)
  if (targetBeyond.source === 'unavailable') return targetBeyond

  const run = sumMetersIntervals([flat(crossingVerticalM), routeInterval(project, qFloor, trunkPath), targetBeyond.run])
  const partnerLabel = hubLabels(qFloor.hubs, walk.lookups.shaftIds)[qFloor.hubs.findIndex((candidate) => candidate.id === partnerHub.id)]
  return { source: 'route', crossingVerticalM, run, viaLabel: `${qFloor.name} ${partnerLabel}` }
}

function startWalk(project: Project, fireAlarmModelById: FireAlarmKindByModelId | undefined): Walk {
  return {
    project,
    lookups: { shaftIds: project.shafts.map((shaft) => shaft.id), fireAlarmModelById, indexCache: new Map() },
    // Total hub count across the whole project - see `resolveBeyond`'s own comment.
    maxDepth: project.floors.reduce((sum, floor) => sum + floor.hubs.length, 0),
  }
}

/**
 * The beyond-length contribution for ONE point. `cable` is needed for a
 * shaft opening only (its own leg); omit it when there is no specific cable
 * in view (the hub panel's "what mode is this point in" query, riser / drop
 * only). `fireAlarmModelById` only feeds a fire-alarm end's label.
 */
export function resolveHubBeyondLength(project: Project, ref: HubRef, cable?: Cable, fireAlarmModelById?: FireAlarmKindByModelId): HubBeyondLength {
  const floorIndex = project.floors.findIndex((floor) => floor.id === ref.floorId)
  const hub = floorIndex === -1 ? undefined : project.floors[floorIndex].hubs.find((candidate) => candidate.id === ref.hubId)
  if (floorIndex === -1 || !hub) return typedBeyond(project.cableSettings.routeHeightM, { mountHeightM: 0 })
  return resolveBeyond(startWalk(project, fireAlarmModelById), floorIndex, hub, cable, new Set(), 0)
}

/**
 * Every floor's hub-ending cables, each resolved to its `HubBeyondLength` -
 * the input `computeCableLayoutEstimate` needs per floor (`beyondByCableId`).
 * A cable ending on a device has no entry. Cached per hub for a plain /
 * riser / drop hub (every cable ending on it shares one result); a cable
 * through a shaft is resolved on its own, since its leg is its own.
 */
export function resolveCableBeyondLengths(project: Project, fireAlarmModelById?: FireAlarmKindByModelId): Map<string, Map<string, HubBeyondLength>> {
  const walk = startWalk(project, fireAlarmModelById)
  const result = new Map<string, Map<string, HubBeyondLength>>()
  project.floors.forEach((floor, floorIndex) => {
    const cableMap = new Map<string, HubBeyondLength>()
    const cache = new Map<string, HubBeyondLength>()
    for (const cable of floor.cables) {
      const hub = cable.hubId === undefined ? undefined : floor.hubs.find((candidate) => candidate.id === cable.hubId)
      if (!hub) continue
      let beyond = hub.kind === 'shaft' ? undefined : cache.get(hub.id)
      if (!beyond) {
        beyond = resolveBeyond(walk, floorIndex, hub, cable, new Set(), 0)
        if (hub.kind !== 'shaft') cache.set(hub.id, beyond)
      }
      cableMap.set(cable.id, beyond)
    }
    result.set(floor.id, cableMap)
  })
  return result
}
