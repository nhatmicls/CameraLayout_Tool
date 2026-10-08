import { bomToCsvTable } from '../../domain/bom/bill-of-materials-grouping'
import { serializeCsv } from '../../domain/export/csv-serializer-with-formula-guard'
import type { Project } from '../../domain/project-file/project-types'
import { triggerBrowserFileDownload } from '../../file-io/browser/trigger-browser-file-download'
import { buildCombinedBomRows } from '../shared/build-combined-bom-rows'
import { sanitizeExportFileName } from '../shared/sanitize-export-file-name'

export interface ExportBomCsvOptions {
  project: Project
  /** The first floor with an image - the stem of the one existing per-project CSV file name, unchanged by this plan. */
  imageFileName: string
}

/**
 * Builds the BOM CSV for the WHOLE PROJECT (plan decision g) - the PNG
 * export strip's columns (`bomToTable`, phase 3/7) plus a trailing `Notes`
 * column (Validation Session 1 owner decision: `bomToCsvTable`) - and
 * triggers a browser download. Camera rows first, then sensor rows, then
 * fire-alarm rows, then cable rows, same order as the PNG strip. Synchronous:
 * CSV generation is cheap enough that no busy indicator is needed, but the
 * caller still wraps this in a try/catch for the (narrow) case of a
 * `Blob`/download failure.
 */
export function exportBomCsv({ project, imageFileName }: ExportBomCsvOptions): void {
  const csv = serializeCsv(bomToCsvTable(buildCombinedBomRows(project).allRows))
  const fileName = `${sanitizeExportFileName(imageFileName)}-camera-bom.csv`
  triggerBrowserFileDownload(csv, fileName, 'text/csv;charset=utf-8')
}
