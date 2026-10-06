import { bomToTable, groupCamerasIntoBom } from '../domain/bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../domain/sensor-bill-of-materials-grouping'
import { serializeCsv } from '../domain/csv-serializer-with-formula-guard'
import type { PlacedCamera, PlanImage } from '../domain/project-types'
import type { PlacedSensor } from '../domain/sensor-types'
import { triggerBrowserFileDownload } from '../file-io/trigger-browser-file-download'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { buildSensorModelByIdRecord } from './sensor-model-by-id-record'
import { sanitizeExportFileName } from './sanitize-export-file-name'

export interface ExportBomCsvOptions {
  image: PlanImage
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
}

/**
 * Builds the BOM CSV - identical columns/order to the PNG export's strip
 * table (both go through `bomToTable`, phase 3/7, so they can never drift
 * apart) - and triggers a browser download. Camera rows first, then sensor
 * rows, same order as the PNG strip. Synchronous: CSV generation is cheap
 * enough that no busy indicator is needed, but the caller still wraps this
 * in a try/catch for the (narrow) case of a `Blob`/download failure.
 */
export function exportBomCsv({ image, cameras, sensors }: ExportBomCsvOptions): void {
  const modelById = buildCameraModelByIdRecord()
  const sensorModelById = buildSensorModelByIdRecord()
  const rows = [...groupCamerasIntoBom(cameras, modelById), ...groupSensorsIntoBom(sensors, sensorModelById)]
  const csv = serializeCsv(bomToTable(rows))
  const fileName = `${sanitizeExportFileName(image.fileName)}-camera-bom.csv`
  triggerBrowserFileDownload(csv, fileName, 'text/csv;charset=utf-8')
}
