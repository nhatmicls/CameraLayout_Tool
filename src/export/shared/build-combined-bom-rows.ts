import { compareCameraBomRows, groupCamerasIntoBom, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { groupCablesIntoBom } from '../../domain/bom/cable-bill-of-materials-grouping'
import { compareCablingPointBomRows, groupCablingPointsIntoBom } from '../../domain/bom/cabling-point-bill-of-materials-grouping'
import { compareFireAlarmBomRows, groupFireAlarmDevicesIntoBom } from '../../domain/bom/fire-alarm-bill-of-materials-grouping'
import { mergeBomRowsAcrossFloors, type FloorBomRows } from '../../domain/bom/merge-bom-rows-across-floors'
import { compareSensorBomRows, groupSensorsIntoBom } from '../../domain/bom/sensor-bill-of-materials-grouping'
import { EMPTY_CABLE_LAYOUT_ESTIMATE, type CableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import { computeProjectCableEstimate, type ProjectCableEstimate } from '../../domain/cable/project-cable-layout-estimate'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
import { floorPositionPrefix } from '../../domain/floor/floor-label-prefix'
import type { FloorWithoutCableScale } from '../../domain/floor/floors-without-cable-scale-note'
import { checkFireAlarmCompatibility, type CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import type { Project } from '../../domain/project-file/project-types'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { fireAlarmCompatibilityIndex, fireAlarmModelSpecById } from './fire-alarm-compatibility-index-singleton'
import { buildSensorModelByIdRecord } from './sensor-model-by-id-record'

export interface CombinedBomRows {
  cameraRows: BomRow[]
  sensorRows: BomRow[]
  fireAlarmRows: BomRow[]
  /** Hub/riser/drop/shaft-opening marker rows, priced `TBD` (owner decision 2026-10-09, phase 6) - fixed kind order (`compareCablingPointBomRows`), only kinds with at least one marker. */
  cablingPointRows: BomRow[]
  /** Empty when the view's floor(s) have no scale (no metres). */
  cableRows: BomRow[]
  /** Cameras, then sensors, then fire-alarm devices, then cabling points, then cables: the row order of the CSV and the PNG table. */
  allRows: BomRow[]
  /** The ONE floor's own estimate when `floorId` is given (its own `cables`/`byCableId`, for the canvas/legend's per-cable limit styling); a project-wide, floor-prefixed-totals stand-in otherwise (`cables`/`byCableId` empty - no single floor's cable list spans the whole project). Either way `.totals`/`.warnings`/`.unestimatedCableCount` are what `cableRows`/the panel/the CSV notice read. */
  cableEstimate: CableLayoutEstimate
  /** From `checkFireAlarmCompatibility`, run once here (over EVERY floor's devices - a controller placed on any floor counts) so the fire-alarm rows' `notes` and the BOM panel's warnings block / PNG legend line can never disagree. */
  fireAlarmWarnings: CompatibilityWarning[]
  /** Floors that hold at least one cable but have no scale - empty when `floorId` is given (that floor's own `scale-not-set` warning already covers it). */
  floorsWithoutScale: FloorWithoutCableScale[]
}

function projectCableEstimateAsLayoutEstimate(estimate: ProjectCableEstimate): CableLayoutEstimate {
  return {
    hasScale: estimate.floorsWithoutScale.length === 0,
    uncertainty: null,
    cables: [],
    byCableId: new Map(),
    totals: estimate.totals,
    grandPurchase: estimate.grandPurchase,
    grandTotalVnd: estimate.grandTotalVnd,
    unpricedTypeCount: estimate.unpricedTypeCount,
    unestimatedCableCount: estimate.unestimatedCableCount,
    warnings: estimate.warnings,
  }
}

/**
 * The one place the BOM's rows are put together - the BOM panel, the CSV
 * and the PNG strip all call this, so their rows and totals cannot drift.
 * Labels are ALWAYS floor-prefixed `F{position}_` (owner decision
 * 2026-10-09, phase 6) - a one-floor project and a floor-scoped
 * (`options.floorId` given) view included, so the BOM panel's per-floor
 * filter and a single floor's own PNG strip read the exact same label text
 * as the project-wide CSV. `options.floorId` omitted -> project-wide rows
 * across every floor; given -> that one floor's own rows only.
 */
export function buildCombinedBomRows(project: Project, options?: { floorId?: string }): CombinedBomRows {
  const cameraModelById = buildCameraModelByIdRecord()
  const sensorModelById = buildSensorModelByIdRecord()

  // Fire-alarm compatibility is checked once over EVERY floor's devices: a controller placed on
  // any floor counts as placed (drift addendum), and `checkFireAlarmCompatibility`'s warnings are
  // keyed by the devices' own (globally unique) ids, so grouping each floor's OWN device array
  // against this one warnings list still reports exactly that floor's own warned labels.
  const allFireAlarmDevices = project.floors.flatMap((floor) => floor.fireAlarmDevices)
  const fireAlarmWarnings = checkFireAlarmCompatibility(allFireAlarmDevices, fireAlarmModelSpecById, fireAlarmCompatibilityIndex)

  const floorsInView = options?.floorId ? project.floors.filter((floor) => floor.id === options.floorId) : project.floors
  const prefixFor = (floor: (typeof project.floors)[number]): string => floorPositionPrefix(project.floors.indexOf(floor))

  const toPerFloor = (rowsByFloor: BomRow[][]): FloorBomRows[] =>
    floorsInView.map((floor, i) => ({ prefix: prefixFor(floor), rows: rowsByFloor[i] }))

  // ONE allocator call per floor (`floor-item-label-allocator.ts`) - cameras, sensors, fire-alarm
  // devices and hubs/risers/drops share their numbering across kinds, so every row's `labels`
  // must come from here, never be recounted inside a grouper.
  const shaftIds = project.shafts.map((shaft) => shaft.id)
  const itemLabelsByFloor = new Map(floorsInView.map((floor) => [floor.id, buildFloorItemLabels(floor, { shaftIds, fireAlarmModelById: fireAlarmModelSpecById })]))
  const itemLabelsFor = (floor: (typeof project.floors)[number]) => itemLabelsByFloor.get(floor.id)!

  const cameraRows = mergeBomRowsAcrossFloors(
    toPerFloor(floorsInView.map((floor) => groupCamerasIntoBom(floor.cameras, cameraModelById, itemLabelsFor(floor).cameras))),
    undefined,
    compareCameraBomRows,
  )
  const sensorRows = mergeBomRowsAcrossFloors(
    toPerFloor(floorsInView.map((floor) => groupSensorsIntoBom(floor.sensors, sensorModelById, itemLabelsFor(floor).sensors))),
    undefined,
    compareSensorBomRows,
  )
  const fireAlarmRows = mergeBomRowsAcrossFloors(
    toPerFloor(
      floorsInView.map((floor) => groupFireAlarmDevicesIntoBom(floor.fireAlarmDevices, fireAlarmModelSpecById, itemLabelsFor(floor).fireAlarmDevices, fireAlarmWarnings)),
    ),
    undefined,
    compareFireAlarmBomRows,
  )
  const cablingPointRows = mergeBomRowsAcrossFloors(
    toPerFloor(floorsInView.map((floor) => groupCablingPointsIntoBom(floor.hubs, itemLabelsFor(floor).hubs))),
    undefined,
    compareCablingPointBomRows,
  )

  let cableEstimate: CableLayoutEstimate
  let floorsWithoutScale: FloorWithoutCableScale[] = []
  if (options?.floorId) {
    cableEstimate = computeProjectCableEstimate(project, fireAlarmModelSpecById).byFloorId.get(options.floorId) ?? EMPTY_CABLE_LAYOUT_ESTIMATE
  } else {
    const projectEstimate = computeProjectCableEstimate(project, fireAlarmModelSpecById)
    cableEstimate = projectCableEstimateAsLayoutEstimate(projectEstimate)
    // H1 fix: gated on > 1 floor - a one-floor project's own `scale-not-set` cable warning
    // already covers it (via `cableEstimate.warnings`), so this note must never ALSO fire for it.
    if (project.floors.length > 1) {
      floorsWithoutScale = project.floors
        .map((floor, index) => ({ floor, position: index + 1 }))
        .filter(({ floor }) => floor.scale === null && floor.cables.length > 0)
        .map(({ floor, position }) => ({ position, name: floor.name }))
    }
  }
  const cableRows = groupCablesIntoBom(cableEstimate)

  return {
    cameraRows,
    sensorRows,
    fireAlarmRows,
    cablingPointRows,
    cableRows,
    allRows: [...cameraRows, ...sensorRows, ...fireAlarmRows, ...cablingPointRows, ...cableRows],
    cableEstimate,
    fireAlarmWarnings,
    floorsWithoutScale,
  }
}
