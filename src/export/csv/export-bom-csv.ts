import { bomToTable } from '../../domain/bom/bill-of-materials-grouping'
import { serializeCsv } from '../../domain/export/csv-serializer-with-formula-guard'
import type { PlanImage } from '../../domain/project-file/project-types'
import { triggerBrowserFileDownload } from '../../file-io/browser/trigger-browser-file-download'
import { buildCombinedBomRows, type BomProjectSlice } from '../shared/build-combined-bom-rows'
import { sanitizeExportFileName } from '../shared/sanitize-export-file-name'

/** `scale` null = the cable rows are left out (no metres without a scale); the caller warns about it. */
export interface ExportBomCsvOptions extends BomProjectSlice {
  image: PlanImage
}

/**
 * Builds the BOM CSV - identical columns/order to the PNG export's strip
 * table (both go through `bomToTable`, phase 3/7, so they can never drift
 * apart) - and triggers a browser download. Camera rows first, then sensor
 * rows, then cable rows, same order as the PNG strip. Synchronous: CSV generation is cheap
 * enough that no busy indicator is needed, but the caller still wraps this
 * in a try/catch for the (narrow) case of a `Blob`/download failure.
 */
export function exportBomCsv({ image, ...project }: ExportBomCsvOptions): void {
  const csv = serializeCsv(bomToTable(buildCombinedBomRows(project).allRows))
  const fileName = `${sanitizeExportFileName(image.fileName)}-camera-bom.csv`
  triggerBrowserFileDownload(csv, fileName, 'text/csv;charset=utf-8')
}
