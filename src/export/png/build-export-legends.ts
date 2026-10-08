import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { SENSOR_KIND_DISPLAY_ORDER, type PlacedSensor, type SensorKind, type SensorModelSpec } from '../../domain/sensor/sensor-types'
import { buildViewFilterNote } from '../../domain/view/view-config-toggle-table'
import { fireAlarmModelSpecById } from '../shared/fire-alarm-compatibility-index-singleton'
import { CELL_PADDING_RATIO, type BomStripContent } from './draw-bom-table-and-legend-strip'
import { buildCableLegend } from './draw-export-cable-legend-line'
import { wrapViewFilterNoteLines } from './draw-export-view-filter-note'
import { resolveCompatibilityWarningText, resolveFireAlarmLegend } from './resolve-fire-alarm-export-legend'
import type { ExportPlanPngOptions } from './export-plan-png'

type ExportLegends = Pick<
  BomStripContent,
  'sensorKindsPresent' | 'cableLegend' | 'fireAlarmLegend' | 'compatibilityWarningText' | 'viewFilterNoteLines'
>

/** Unique kinds among `sensors` whose model is known (skips a dangling `modelId`, same as the BOM grouping), in `SENSOR_KIND_DISPLAY_ORDER`. */
function resolveSensorKindsPresent(sensors: readonly PlacedSensor[], sensorModelById: Record<string, SensorModelSpec>): SensorKind[] {
  const present = new Set<SensorKind>()
  for (const sensor of sensors) {
    const model = sensorModelById[sensor.modelId]
    if (model) present.add(model.kind)
  }
  return SENSOR_KIND_DISPLAY_ORDER.filter((kind) => present.has(kind))
}

/**
 * Every legend line's content, built before the strip's final layout (its
 * height depends on how many lines these draw - `legendLineCountFor`).
 * Split out of `export-plan-png.ts` to keep that file under 200 lines.
 */
export function buildExportLegends(
  options: ExportPlanPngOptions,
  fireAlarmWarnings: readonly CompatibilityWarning[],
  sensorModelById: Record<string, SensorModelSpec>,
  fontPx: number,
): ExportLegends {
  const scaleIsSet = options.scale !== null
  // Null when nothing is hidden: no note lines, so the strip (and the whole PNG) is what it was before the view config existed.
  const viewFilterNote = buildViewFilterNote(options.viewConfig)
  return {
    sensorKindsPresent: resolveSensorKindsPresent(options.sensors, sensorModelById),
    cableLegend: buildCableLegend(options.cables, options.cableTypes, options.cableSettings, options.cableEstimate),
    fireAlarmLegend: resolveFireAlarmLegend(options.fireAlarmDevices, fireAlarmModelSpecById, options.fireAlarmSettings, scaleIsSet),
    compatibilityWarningText: resolveCompatibilityWarningText(options.fireAlarmDevices, fireAlarmWarnings),
    viewFilterNoteLines: viewFilterNote
      ? wrapViewFilterNoteLines(viewFilterNote, fontPx, options.image.widthPx, fontPx * CELL_PADDING_RATIO)
      : [],
  }
}
