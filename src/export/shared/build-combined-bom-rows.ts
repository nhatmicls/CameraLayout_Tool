import { groupCamerasIntoBom, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { groupCablesIntoBom } from '../../domain/bom/cable-bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../../domain/bom/sensor-bill-of-materials-grouping'
import { computeCableLayoutEstimate, type CableLayoutEstimate, type CableLayoutEstimateInput } from '../../domain/cable/cable-layout-estimate'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { buildSensorModelByIdRecord } from './sensor-model-by-id-record'

export interface CombinedBomRows {
  cameraRows: BomRow[]
  sensorRows: BomRow[]
  /** Empty when the scale is not set (no metres). */
  cableRows: BomRow[]
  /** Cameras, then sensors, then cables: the row order of the CSV and the PNG table. */
  allRows: BomRow[]
  cableEstimate: CableLayoutEstimate
}

/** What the BOM is built from: the placed items, the cable layout and the scale. */
export interface BomProjectSlice extends CableLayoutEstimateInput {
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
}

/**
 * The one place the BOM's rows are put together - the BOM panel, the CSV
 * and the PNG strip all call this, so their rows and totals cannot drift.
 */
export function buildCombinedBomRows(project: BomProjectSlice): CombinedBomRows {
  const cameraRows = groupCamerasIntoBom(project.cameras, buildCameraModelByIdRecord())
  const sensorRows = groupSensorsIntoBom(project.sensors, buildSensorModelByIdRecord())
  const cableEstimate = computeCableLayoutEstimate(project)
  const cableRows = groupCablesIntoBom(cableEstimate)
  return { cameraRows, sensorRows, cableRows, allRows: [...cameraRows, ...sensorRows, ...cableRows], cableEstimate }
}
