import { computeCableLayoutEstimate, type CableEstimateWarning, type CableLayoutEstimate, type CableTypeTotal } from './cable-layout-estimate'
import type { Cable, Hub } from './cable-layout-types'
import { sumMetersIntervals, type MetersInterval } from './cable-length-estimate-calculator'
import { ceilMeters } from './cable-length-format'
import { resolveCableBeyondLengths } from './cross-floor-hub-beyond-length-resolver'
import { resolveCrossFloorExit } from './cross-floor-exit-resolver'
import { findShaftExits, findShaftMarkers } from './shaft-integrity'
import { floorLabelPrefix } from '../floor/floor-label-prefix'
import type { Floor } from '../floor/floor-types'
import type { Project } from '../project-file/project-types'

/**
 * THE entry point for cable estimates once a project has more than one
 * floor: panels, the canvas (over-length styling), the BOM and the exports
 * all read from here (directly, or through `useProjectCableEstimate`/
 * `useCableLayoutEstimate`) - `computeCableLayoutEstimate` becomes the
 * per-floor building block this calls, never called on its own outside
 * `src/domain/cable`.
 */
export interface ProjectCableEstimate {
  /** Every floor's own estimate (cross-floor contributions already resolved) - exactly `useCableLayoutEstimate()`'s shape, per floor. */
  byFloorId: ReadonlyMap<string, CableLayoutEstimate>
  /** Summed across every floor, per type; whole metres rounded up ONCE on the sum (a per-floor strip can therefore read up to `floors.length - 1` m higher - noted in README). Labels floor-prefixed `F{position}_` only when the project has more than one floor. */
  totals: CableTypeTotal[]
  grandPurchase: MetersInterval | null
  grandTotalVnd: number
  unpricedTypeCount: number
  /** Floors with no scale set, in floor order - whether or not they currently hold a cable. */
  floorsWithoutScale: { id: string; name: string }[]
  /** Every floor's own warnings, concatenated in floor order, plus the project-level shaft-no-exit warnings. */
  warnings: CableEstimateWarning[]
  /** Sum of every floor's own `unestimatedCableCount` (phase 7: the project-wide BOM/CSV/PNG notice needs one number, not a per-floor lookup). */
  unestimatedCableCount: number
}

/**
 * A single-slot, reference-equality memo (item 5 perf fix): the app has
 * exactly ONE live project, so caching the last `(floors, shafts, cableTypes,
 * cableSettings)` tuple -> result is enough - without it, N components each
 * calling `useProjectCableEstimate`/`useCableLayoutEstimate` would each run
 * their OWN `useMemo`, recomputing the whole project's cable estimate N
 * times per render for identical inputs (React memoises per call site, not
 * per argument). `fireAlarmSettings` is deliberately NOT part of the key -
 * the cable estimate never reads it, so toggling the TCVN coverage mode
 * must not invalidate this cache. Safe indefinitely: every real edit (the
 * store's immutable updates) produces a NEW `floors` array, so a stale
 * cache can never be read back - no explicit reset needed (confirmed by
 * `resetProject`/`replaceProject` always producing fresh floor objects too).
 */
let cachedKey: Pick<Project, 'floors' | 'shafts' | 'cableTypes' | 'cableSettings'> | null = null
let cachedResult: ProjectCableEstimate | null = null

export function computeProjectCableEstimate(project: Project): ProjectCableEstimate {
  if (
    cachedKey &&
    cachedKey.floors === project.floors &&
    cachedKey.shafts === project.shafts &&
    cachedKey.cableTypes === project.cableTypes &&
    cachedKey.cableSettings === project.cableSettings
  ) {
    return cachedResult!
  }
  const result = computeProjectCableEstimateUncached(project)
  cachedKey = { floors: project.floors, shafts: project.shafts, cableTypes: project.cableTypes, cableSettings: project.cableSettings }
  cachedResult = result
  return result
}

/**
 * ">F3" when `cable` ends on a shaft marker with SEVERAL exits (CLAUDE.md:
 * the label carries the exit floor only once there is more than one exit to
 * disambiguate - `C1-T1` stays bare with exactly one, same as a plain hub
 * or a riser/drop pair, which are never ambiguous and never get this
 * suffix). `""` when the shaft has no exit yet or this cable's exit is not
 * (yet) chosen - those cases already carry their own warning
 * (`shaft-no-exit` / `shaft-exit-not-chosen`); the label itself stays plain.
 */
function resolveCableLabelExitSuffix(floors: readonly Floor[], floor: Floor, cable: Cable, hub: Hub): string {
  if (hub.kind !== 'shaft' || !hub.shaftId) return ''
  if (findShaftExits(floors, hub.shaftId).length <= 1) return ''
  const exit = resolveCrossFloorExit(floors, { floorId: floor.id, hubId: hub.id }, cable)
  return exit.kind === 'exit' ? `>F${exit.floorIndex + 1}` : ''
}

/** One info warning per shaft that has at least one marker but NO exit anywhere - never per cable, never per floor (`shaft-no-exit`, confirmed behaviour). */
function shaftNoExitWarnings(project: Project): CableEstimateWarning[] {
  const warnings: CableEstimateWarning[] = []
  for (const shaft of project.shafts) {
    const markers = findShaftMarkers(project.floors, shaft.id)
    if (markers.length === 0) continue
    if (findShaftExits(project.floors, shaft.id).length > 0) continue
    warnings.push({ code: 'shaft-no-exit', message: `${shaft.name} has no exit route yet - typed length in use.` })
  }
  return warnings
}

function computeProjectCableEstimateUncached(project: Project): ProjectCableEstimate {
  const beyondByFloorId = resolveCableBeyondLengths(project)
  const shaftIds = project.shafts.map((shaft) => shaft.id)
  const byFloorId = new Map<string, CableLayoutEstimate>()
  for (const floor of project.floors) {
    byFloorId.set(
      floor.id,
      computeCableLayoutEstimate({
        cameras: floor.cameras,
        sensors: floor.sensors,
        hubs: floor.hubs,
        cables: floor.cables,
        cableTypes: project.cableTypes,
        cableSettings: project.cableSettings,
        scale: floor.scale,
        beyondByCableId: beyondByFloorId.get(floor.id),
        shaftIds,
      }),
    )
  }

  const totals: CableTypeTotal[] = []
  for (const type of project.cableTypes) {
    const perFloor = project.floors
      .map((floor, floorIndex) => ({ floorIndex, total: byFloorId.get(floor.id)!.totals.find((candidate) => candidate.type.id === type.id) }))
      .filter((entry): entry is { floorIndex: number; total: CableTypeTotal } => entry.total !== undefined)
    if (perFloor.length === 0) continue

    const purchase = sumMetersIntervals(perFloor.map((entry) => entry.total.purchase))
    const purchaseWholeM = ceilMeters(purchase.nominal)
    totals.push({
      type,
      cableCount: perFloor.reduce((sum, entry) => sum + entry.total.cableCount, 0),
      // Same cables/order `entry.total.labels` was built from (`cable-layout-estimate.ts`'s own
      // `ofType` filter) - walked here via the full `CableLengthEstimate[]` instead of the bare
      // label strings so each one's exit-floor suffix (`resolveCableLabelExitSuffix`) can be
      // computed from its own `Cable`/`Hub`, then the floor prefix applied as before.
      labels: perFloor.flatMap((entry) => {
        const floor = project.floors[entry.floorIndex]
        const prefix = floorLabelPrefix(entry.floorIndex, project.floors.length)
        return byFloorId
          .get(floor.id)!
          .cables.filter((estimate) => estimate.typeId === type.id)
          .map((estimate) => {
            const cable = floor.cables.find((candidate) => candidate.id === estimate.cableId)
            const hub = cable ? floor.hubs.find((candidate) => candidate.id === cable.hubId) : undefined
            const suffix = cable && hub ? resolveCableLabelExitSuffix(project.floors, floor, cable, hub) : ''
            return `${prefix}${estimate.label}${suffix}`
          })
      }),
      run: sumMetersIntervals(perFloor.map((entry) => entry.total.run)),
      purchase,
      purchaseWholeM,
      lineTotalVnd: type.pricePerMeterVnd === null ? null : purchaseWholeM * type.pricePerMeterVnd,
    })
  }

  return {
    byFloorId,
    totals,
    grandPurchase: totals.length > 0 ? sumMetersIntervals(totals.map((total) => total.purchase)) : null,
    grandTotalVnd: totals.reduce((sum, total) => sum + (total.lineTotalVnd ?? 0), 0),
    unpricedTypeCount: totals.filter((total) => total.lineTotalVnd === null).length,
    floorsWithoutScale: project.floors.filter((floor) => floor.scale === null).map((floor) => ({ id: floor.id, name: floor.name })),
    warnings: [...project.floors.flatMap((floor) => byFloorId.get(floor.id)!.warnings), ...shaftNoExitWarnings(project)],
    unestimatedCableCount: project.floors.reduce((sum, floor) => sum + byFloorId.get(floor.id)!.unestimatedCableCount, 0),
  }
}
