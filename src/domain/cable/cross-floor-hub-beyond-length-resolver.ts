import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import { buildFloorItemLabels } from '../floor/floor-item-label-allocator'
import type { Floor } from '../floor/floor-types'
import type { Project } from '../project-file/project-types'
import { planPxToMeters } from '../shared/scale-calibration-calculator'
import { computeScaleUncertainty, polylineLengthPx, sumMetersIntervals, type MetersInterval } from './cable-length-estimate-calculator'
import { hubEffectiveHeightM, type Cable, type CablePoint, type Hub, type HubRef } from './cable-layout-types'
import { walkCrossFloorRoute, walkCrossFloorRouteFromHub, type CrossFloorRoute, type CrossFloorRouteEnd, type CrossFloorRouteHop } from './cross-floor-route-walker'
import type { ShaftLegLookups } from './shaft-cable-leg'

/**
 * What a cable finds "beyond" the hub it ends on, in metres - a fold of
 * `walkCrossFloorRoute`'s topology.
 *
 * - `typed`: the hub's own typed values (a plain hub, an unlinked riser /
 *   drop, or a linked one whose partner has no trunk). `shaftNotRouted` = a
 *   shaft opening the cable is not routed beyond yet: 0 m at the opening +
 *   its typed `extraLengthM`.
 * - `route`: a measured continuation - vertical from `floorHeightM`, plus a
 *   route on the other floor at that floor's scale, plus whatever is beyond
 *   where it ends. Either a riser / drop pair's trunk (chains continue), or
 *   the cable's own leg beyond a shaft. `viaLabel` always names the FIRST
 *   hop's own exit (HEAD never propagated a nested hop's label either) -
 *   used only for the cable panel's breakdown line; the cable's own
 *   end-to-end label comes from `buildProjectCableEndToEndLabels` instead.
 * - `unavailable`: the route hit a floor with no scale or a cycle
 *   (crafted / corrupt file) - never silently 0.
 */
export type HubBeyondLength =
  | { source: 'typed'; run: MetersInterval; shaftNotRouted?: boolean }
  | { source: 'route'; crossingVerticalM: number; run: MetersInterval; viaLabel: string; endsOnDevice?: boolean }
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

const flat = (m: number): MetersInterval => ({ nominal: m, min: m, max: m })

/**
 * Riser / drop / plain hub: `|routeHeightM - hubEffectiveHeightM(hub)| + extraLengthM`.
 * Shaft opening (a cable not routed beyond it): 0 m AT the opening + its own
 * `extraLengthM`, no `routeHeightM` term - an opening's `mountHeightM` is
 * always 0 and carries no floor-crossing meaning.
 */
function typedBeyond(routeHeightM: number, hub: Pick<Hub, 'kind' | 'mountHeightM' | 'extraLengthM'>): HubBeyondLength {
  if (hub.kind === 'shaft') return { source: 'typed', run: flat(hub.extraLengthM ?? 0), shaftNotRouted: true }
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

const hopPathPx = (hop: CrossFloorRouteHop): readonly CablePoint[] => (hop.kind === 'pair' ? hop.pathPx : hop.leg.pathPx)

/** HEAD's own via-label format per hop kind: pair = the exit floor's own partner hub; shaft-leg = the exit floor's own leg end. */
function hopViaLabel(floors: readonly Floor[], hop: CrossFloorRouteHop, lookups: ShaftLegLookups): string {
  const exitFloor = floors[hop.exitFloorIndex]
  if (hop.kind === 'shaft-leg') return `${exitFloor.name} ${hop.leg.end.label}`
  const index = exitFloor.hubs.findIndex((candidate) => candidate.id === hop.exitHub.id)
  return `${exitFloor.name} ${buildFloorItemLabels(exitFloor, lookups).hubs[index]}`
}

/** The walked route's end, resolved to its OWN contribution - ignoring every hop before it. */
function resolveRouteEnd(project: Project, end: CrossFloorRouteEnd): HubBeyondLength {
  const { routeHeightM, defaultDeviceHeightM } = project.cableSettings
  if (end.kind === 'hub') return typedBeyond(routeHeightM, end.hub)
  if (end.kind === 'device') return { source: 'typed', run: flat(Math.abs(routeHeightM - (end.device.mountHeightM ?? defaultDeviceHeightM))) }
  if (end.kind === 'missing') {
    // Defensive - unreachable on a live project: `resolveBeyond` always starts from an already
    // resolved (floorIndex, hub), so the walk it drives can never end "missing".
    return { source: 'unavailable', reason: 'link-cycle', floorName: '?' }
  }
  const floor = project.floors[end.floorIndex]
  if (end.kind === 'cycle') return { source: 'unavailable', reason: 'link-cycle', floorName: floor.name }
  // 'broken' (defensive - unreachable on a live project): the exit floor's own scale picks the
  // honest reason.
  return { source: 'unavailable', reason: floor.scale ? 'link-cycle' : 'linked-floor-scale-not-set', floorName: floor.name }
}

/**
 * Folds a walked route into metres, reproducing HEAD's own precedence
 * exactly: (1) every hop's exit floor must have a scale, checked in walk
 * order - the FIRST missing one wins, before the end is even considered;
 * (2) only then the end's own contribution; (3) zero hops = that
 * contribution as-is, otherwise folded from the LAST hop back, so each
 * hop's own horizontal route adds to whatever is beyond it.
 */
function foldRoute(project: Project, route: CrossFloorRoute, lookups: ShaftLegLookups): HubBeyondLength {
  for (const hop of route.hops) {
    const exitFloor = project.floors[hop.exitFloorIndex]
    if (!exitFloor.scale) return { source: 'unavailable', reason: 'linked-floor-scale-not-set', floorName: exitFloor.name }
  }

  const endResult = resolveRouteEnd(project, route.end)
  if (route.hops.length === 0 || endResult.source === 'unavailable') return endResult

  let runBeyond = endResult.run
  for (let i = route.hops.length - 1; i >= 0; i--) {
    const hop = route.hops[i]
    const crossingM = sumFloorHeightsBetween(project.floors, hop.fromFloorIndex, hop.exitFloorIndex)
    const exitFloor = project.floors[hop.exitFloorIndex]
    runBeyond = sumMetersIntervals([flat(crossingM), routeInterval(project, exitFloor, hopPathPx(hop)), runBeyond])
  }
  const firstHop = route.hops[0]
  return {
    source: 'route',
    crossingVerticalM: sumFloorHeightsBetween(project.floors, firstHop.fromFloorIndex, firstHop.exitFloorIndex),
    run: runBeyond,
    viaLabel: hopViaLabel(project.floors, firstHop, lookups),
    ...(firstHop.kind === 'shaft-leg' ? { endsOnDevice: route.end.kind === 'device' } : {}),
  }
}

function startLookups(project: Project, fireAlarmModelById: FireAlarmKindByModelId | undefined): ShaftLegLookups {
  return { shaftIds: project.shafts.map((shaft) => shaft.id), fireAlarmModelById, indexCache: new Map() }
}

function resolveBeyond(project: Project, floorIndex: number, hub: Hub, cable: Cable | undefined, lookups: ShaftLegLookups): HubBeyondLength {
  const route = cable ? walkCrossFloorRoute(project.floors, floorIndex, cable, lookups) : walkCrossFloorRouteFromHub(project.floors, floorIndex, hub)
  return foldRoute(project, route, lookups)
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
  return resolveBeyond(project, floorIndex, hub, cable, startLookups(project, fireAlarmModelById))
}

/**
 * Every floor's hub-ending cables, each resolved to its `HubBeyondLength` -
 * the input `computeCableLayoutEstimate` needs per floor (`beyondByCableId`).
 * A cable ending on a device has no entry. Cached per hub for a plain /
 * riser / drop hub (every cable ending on it shares one result); a cable
 * through a shaft is resolved on its own, since its leg is its own.
 */
export function resolveCableBeyondLengths(project: Project, fireAlarmModelById?: FireAlarmKindByModelId): Map<string, Map<string, HubBeyondLength>> {
  const lookups = startLookups(project, fireAlarmModelById)
  const result = new Map<string, Map<string, HubBeyondLength>>()
  project.floors.forEach((floor, floorIndex) => {
    const cableMap = new Map<string, HubBeyondLength>()
    const cache = new Map<string, HubBeyondLength>()
    for (const cable of floor.cables) {
      const hub = cable.hubId === undefined ? undefined : floor.hubs.find((candidate) => candidate.id === cable.hubId)
      if (!hub) continue
      let beyond = hub.kind === 'shaft' ? undefined : cache.get(hub.id)
      if (!beyond) {
        beyond = resolveBeyond(project, floorIndex, hub, cable, lookups)
        if (hub.kind !== 'shaft') cache.set(hub.id, beyond)
      }
      cableMap.set(cable.id, beyond)
    }
    result.set(floor.id, cableMap)
  })
  return result
}
