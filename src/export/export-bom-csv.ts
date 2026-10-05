import { bomToTable, groupCamerasIntoBom } from '../domain/bill-of-materials-grouping'
import { serializeCsv } from '../domain/csv-serializer-with-formula-guard'
import type { PlacedCamera, PlanImage } from '../domain/project-types'
import { triggerBrowserFileDownload } from '../file-io/trigger-browser-file-download'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { sanitizeExportFileName } from './sanitize-export-file-name'

export interface ExportBomCsvOptions {
  image: PlanImage
  cameras: PlacedCamera[]
}

/**
 * Builds the BOM CSV - identical columns/order to the PNG export's strip
 * table (both go through `bomToTable`, phase 3, so they can never drift
 * apart) - and triggers a browser download. Synchronous: CSV generation is
 * cheap enough that no busy indicator is needed, but the caller still
 * wraps this in a try/catch for the (narrow) case of a `Blob`/download
 * failure.
 */
export function exportBomCsv({ image, cameras }: ExportBomCsvOptions): void {
  const modelById = buildCameraModelByIdRecord()
  const rows = groupCamerasIntoBom(cameras, modelById)
  const csv = serializeCsv(bomToTable(rows))
  const fileName = `${sanitizeExportFileName(image.fileName)}-camera-bom.csv`
  triggerBrowserFileDownload(csv, fileName, 'text/csv;charset=utf-8')
}
