import { groupCamerasIntoBom, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { groupCablesIntoBom } from '../../domain/bom/cable-bill-of-materials-grouping'
import { groupFireAlarmDevicesIntoBom } from '../../domain/bom/fire-alarm-bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../../domain/bom/sensor-bill-of-materials-grouping'
import { computeCableLayoutEstimate, type CableLayoutEstimate, type CableLayoutEstimateInput } from '../../domain/cable/cable-layout-estimate'
import { checkFireAlarmCompatibility, type CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { fireAlarmCompatibilityIndex, fireAlarmModelSpecById } from './fire-alarm-compatibility-index-singleton'
import { buildSensorModelByIdRecord } from './sensor-model-by-id-record'

export interface CombinedBomRows {
  cameraRows: BomRow[]
  sensorRows: BomRow[]
  fireAlarmRows: BomRow[]
  /** Empty when the scale is not set (no metres). */
  cableRows: BomRow[]
  /** Cameras, then sensors, then fire-alarm devices, then cables: the row order of the CSV and the PNG table. */
  allRows: BomRow[]
  cableEstimate: CableLayoutEstimate
  /** From `checkFireAlarmCompatibility`, run once here so the fire-alarm rows' `notes` and the BOM panel's warnings block / PNG legend line can never disagree. */
  fireAlarmWarnings: CompatibilityWarning[]
}

/** What the BOM is built from: the placed items, the cable layout and the scale. */
export interface BomProjectSlice extends CableLayoutEstimateInput {
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
}

/**
 * The one place the BOM's rows are put together - the BOM panel, the CSV
 * and the PNG strip all call this, so their rows and totals cannot drift.
 */
export function buildCombinedBomRows(project: BomProjectSlice): CombinedBomRows {
  const cameraRows = groupCamerasIntoBom(project.cameras, buildCameraModelByIdRecord())
  const sensorRows = groupSensorsIntoBom(project.sensors, buildSensorModelByIdRecord())
  const fireAlarmWarnings = checkFireAlarmCompatibility(project.fireAlarmDevices, fireAlarmModelSpecById, fireAlarmCompatibilityIndex)
  const fireAlarmRows = groupFireAlarmDevicesIntoBom(project.fireAlarmDevices, fireAlarmModelSpecById, fireAlarmWarnings)
  const cableEstimate = computeCableLayoutEstimate(project)
  const cableRows = groupCablesIntoBom(cableEstimate)
  return {
    cameraRows,
    sensorRows,
    fireAlarmRows,
    cableRows,
    allRows: [...cameraRows, ...sensorRows, ...fireAlarmRows, ...cableRows],
    cableEstimate,
    fireAlarmWarnings,
  }
}
