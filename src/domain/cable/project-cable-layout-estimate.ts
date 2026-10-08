import { computeCableLayoutEstimate, type CableEstimateWarning, type CableLayoutEstimate, type CableTypeTotal } from './cable-layout-estimate'
import { sumMetersIntervals, type MetersInterval } from './cable-length-estimate-calculator'
import { ceilMeters } from './cable-length-format'
import { resolveCableBeyondLengths } from './cross-floor-hub-beyond-length-resolver'
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
  /** Summed across every floor, per type; whole metres rounded up ONCE on the sum (a per-floor strip can therefore read up to `floors.length - 1` m higher - noted in README). Labels floor-prefixed `F{position}-` only when the project has more than one floor. */
  totals: CableTypeTotal[]
  grandPurchase: MetersInterval | null
  grandTotalVnd: number
  unpricedTypeCount: number
  /** Floors with no scale set, in floor order - whether or not they currently hold a cable. */
  floorsWithoutScale: { id: string; name: string }[]
  /** Every floor's own warnings, concatenated in floor order. */
  warnings: CableEstimateWarning[]
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

function computeProjectCableEstimateUncached(project: Project): ProjectCableEstimate {
  const beyondByFloorId = resolveCableBeyondLengths(project)
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
      }),
    )
  }

  const multiFloor = project.floors.length > 1
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
      labels: perFloor.flatMap((entry) =>
        multiFloor ? entry.total.labels.map((label) => `F${entry.floorIndex + 1}-${label}`) : entry.total.labels,
      ),
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
    warnings: project.floors.flatMap((floor) => byFloorId.get(floor.id)!.warnings),
  }
}
