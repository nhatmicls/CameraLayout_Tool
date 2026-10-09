import { compareCameraBomRows, groupCamerasIntoBom, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { groupCablesIntoBom } from '../../domain/bom/cable-bill-of-materials-grouping'
import { compareFireAlarmBomRows, groupFireAlarmDevicesIntoBom } from '../../domain/bom/fire-alarm-bill-of-materials-grouping'
import { mergeBomRowsAcrossFloors, type FloorBomRows } from '../../domain/bom/merge-bom-rows-across-floors'
import { compareSensorBomRows, groupSensorsIntoBom } from '../../domain/bom/sensor-bill-of-materials-grouping'
import { EMPTY_CABLE_LAYOUT_ESTIMATE, type CableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import { computeProjectCableEstimate, type ProjectCableEstimate } from '../../domain/cable/project-cable-layout-estimate'
import { floorLabelPrefix } from '../../domain/floor/floor-label-prefix'
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
  /** Empty when the view's floor(s) have no scale (no metres). */
  cableRows: BomRow[]
  /** Cameras, then sensors, then fire-alarm devices, then cables: the row order of the CSV and the PNG table. */
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
 * `options.floorId` omitted (or the project has one floor, where the prefix
 * is always `''` anyway) -> project-wide rows, labels floor-prefixed
 * `F{position}_` (plan decision d); `options.floorId` given -> that one
 * floor's own rows, unprefixed, exactly like a single-floor project's
 * (the BOM panel's per-floor filter and a single floor's own PNG strip use
 * this).
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
  const prefixFor = (floor: (typeof project.floors)[number]): string => {
    if (options?.floorId) return ''
    return floorLabelPrefix(project.floors.indexOf(floor), project.floors.length)
  }

  const toPerFloor = (rowsByFloor: BomRow[][]): FloorBomRows[] =>
    floorsInView.map((floor, i) => ({ prefix: prefixFor(floor), rows: rowsByFloor[i] }))

  const cameraRows = mergeBomRowsAcrossFloors(
    toPerFloor(floorsInView.map((floor) => groupCamerasIntoBom(floor.cameras, cameraModelById))),
    undefined,
    compareCameraBomRows,
  )
  const sensorRows = mergeBomRowsAcrossFloors(
    toPerFloor(floorsInView.map((floor) => groupSensorsIntoBom(floor.sensors, sensorModelById))),
    undefined,
    compareSensorBomRows,
  )
  const fireAlarmRows = mergeBomRowsAcrossFloors(
    toPerFloor(floorsInView.map((floor) => groupFireAlarmDevicesIntoBom(floor.fireAlarmDevices, fireAlarmModelSpecById, fireAlarmWarnings))),
    undefined,
    compareFireAlarmBomRows,
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
    cableRows,
    allRows: [...cameraRows, ...sensorRows, ...fireAlarmRows, ...cableRows],
    cableEstimate,
    fireAlarmWarnings,
    floorsWithoutScale,
  }
}
