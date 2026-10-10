import { buildProjectCableListRows, cableListToCsvTable } from '../../domain/cable/project-cable-list-rows'
import { serializeCsv } from '../../domain/export/csv-serializer-with-formula-guard'
import type { Project } from '../../domain/project-file/project-types'
import { triggerBrowserFileDownload } from '../../file-io/browser/trigger-browser-file-download'
import { fireAlarmModelSpecById } from '../shared/fire-alarm-compatibility-index-singleton'
import { sanitizeExportFileName } from '../shared/sanitize-export-file-name'

export interface ExportCableLengthEstimateCsvOptions {
  project: Project
  /** Same stem the BOM CSV uses (the first floor with an image) - the two downloads of one click sort together. */
  imageFileName: string
}

/**
 * The per-cable length CSV (`Cable, Type, Length (+N% spare) (m), Notes`) -
 * a companion to the BOM CSV, triggered right after it on the same click.
 * One row per cable of the WHOLE project (`buildProjectCableListRows`,
 * floor order) - lengths come only from the live cable estimate, never
 * guessed. Returns `false` (no download triggered) when the project has no
 * cable at all, so the caller can skip its own "downloaded" notification.
 */
export function exportCableLengthEstimateCsv({ project, imageFileName }: ExportCableLengthEstimateCsvOptions): boolean {
  if (project.floors.every((floor) => floor.cables.length === 0)) return false

  const rows = buildProjectCableListRows(project, { fireAlarmModelById: fireAlarmModelSpecById })
  const csv = serializeCsv(cableListToCsvTable(rows, project.cableSettings.wastePercent))
  const fileName = `${sanitizeExportFileName(imageFileName)}-cable_length_estimate.csv`
  triggerBrowserFileDownload(csv, fileName, 'text/csv;charset=utf-8')
  return true
}
