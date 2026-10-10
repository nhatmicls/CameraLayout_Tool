import type { Shaft } from '../../domain/cable/cable-layout-types'
import { filterCompatibilityWarningsToDeviceIds, type CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
import { SENSOR_KIND_DISPLAY_ORDER, type PlacedSensor, type SensorKind, type SensorModelSpec } from '../../domain/sensor/sensor-types'
import { buildViewFilterNote } from '../../domain/view/view-config-toggle-table'
import { fireAlarmModelSpecById } from '../shared/fire-alarm-compatibility-index-singleton'
import { CELL_PADDING_RATIO, type BomStripContent } from './draw-bom-table-and-legend-strip'
import { buildCableLegend } from './draw-export-cable-legend-line'
import { wrapPlainTextToStripWidth, wrapViewFilterNoteLines } from './draw-export-view-filter-note'
import { resolveCompatibilityWarningText, resolveFireAlarmLegend } from './resolve-fire-alarm-export-legend'
import type { ExportPlanPngOptions } from './export-plan-png'

/** This floor's 0-based position and the project's floor count/name, for the "F2 of 3 - Level 2" strip note (phase 7). `count <= 1` (every pre-phase-7 caller/test) draws no note. */
export interface FloorPositionContext {
  index: number
  count: number
  name: string
}

type ExportLegends = Pick<
  BomStripContent,
  'sensorKindsPresent' | 'cableLegend' | 'fireAlarmLegend' | 'compatibilityWarningText' | 'viewFilterNoteLines' | 'floorNoteLines' | 'shaftsOnFloorLines'
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

/** "F2 of 3 - Level 2"; `null` for a one-floor project (or no context at all - every pre-phase-7 caller). Exported for direct testing. */
export function describeFloorPosition(context: FloorPositionContext | undefined): string | null {
  if (!context || context.count <= 1) return null
  return `F${context.index + 1} of ${context.count} - ${context.name}`
}

/**
 * "Shafts: T1 Main riser, T2 Back shaft" - only the shafts that have a
 * marker on THIS floor's own `hubs`, so the `T{n}` glyphs on the picture can
 * be read; `null` when `shafts` is omitted, this floor has none, or the
 * project has only one floor (M5 review fix: plan decision g - strip notes
 * only apply once there is more than one floor; a shaft cannot exist on a
 * true one-floor project, but this keeps the rule explicit rather than
 * relying on that incidental fact). `hubLabels` is index-aligned with `hubs`,
 * from the shared allocator (`floor-item-label-allocator.ts`). Exported for
 * direct testing.
 */
export function describeShaftsOnFloor(
  hubs: readonly { kind?: string; shaftId?: string }[],
  hubLabels: readonly string[],
  shafts: readonly Shaft[] | undefined,
  floorCount: number | undefined,
): string | null {
  if (!shafts || shafts.length === 0 || !floorCount || floorCount <= 1) return null
  const nameById = new Map(shafts.map((shaft) => [shaft.id, shaft.name]))
  const entries = hubs
    .map((hub, i) => (hub.kind === 'shaft' && hub.shaftId ? `${hubLabels[i]} ${nameById.get(hub.shaftId) ?? ''}`.trim() : null))
    .filter((entry): entry is string => entry !== null)
  return entries.length > 0 ? `Shafts: ${entries.join(', ')}` : null
}

/** Appends the per-floor cable-metres rounding note (plan decision f, validated) to the cable legend's own note text - only when the project has more than one floor and there is a cable legend to append to. */
function withRoundingNote(cableLegend: BomStripContent['cableLegend'], floorCount: number | undefined): BomStripContent['cableLegend'] {
  if (!cableLegend || !floorCount || floorCount <= 1) return cableLegend
  const roundingNote = 'Cable metres rounded per floor'
  return { ...cableLegend, noteText: [cableLegend.noteText, roundingNote].filter(Boolean).join('  ·  ') }
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
  const sidePaddingPx = fontPx * CELL_PADDING_RATIO
  const wrapLine = (text: string | null) => wrapPlainTextToStripWidth(text ?? '', fontPx, options.image.widthPx, sidePaddingPx)

  // C1 review fix: `fireAlarmWarnings` is computed once for the WHOLE project (phase 7) - a
  // warning naming a device on another floor must never reach this floor's legend text (it would
  // either label against the wrong index or, pre-fix, fall back to the device's raw internal id).
  const deviceIdsOnThisFloor = new Set(options.fireAlarmDevices.map((device) => device.id))
  const ownFloorWarnings = filterCompatibilityWarningsToDeviceIds(fireAlarmWarnings, deviceIdsOnThisFloor)

  // ONE allocator call for every label this strip shows (`floor-item-label-allocator.ts`) - the
  // fire-alarm legend's device labels and the shaft note's hub labels must agree with the canvas.
  const itemLabels = buildFloorItemLabels(
    { cameras: options.cameras, sensors: options.sensors, fireAlarmDevices: options.fireAlarmDevices, hubs: options.hubs },
    { shaftIds: options.shaftIds, fireAlarmModelById: fireAlarmModelSpecById },
  )

  return {
    sensorKindsPresent: resolveSensorKindsPresent(options.sensors, sensorModelById),
    cableLegend: withRoundingNote(
      buildCableLegend(
        options.cables,
        options.cableTypes,
        options.cableSettings,
        options.cableEstimate,
        options.hubs.some((hub) => hub.trunk !== undefined),
      ),
      options.floorPosition?.count,
    ),
    fireAlarmLegend: resolveFireAlarmLegend(options.fireAlarmDevices, fireAlarmModelSpecById, options.fireAlarmSettings, scaleIsSet),
    compatibilityWarningText: resolveCompatibilityWarningText(options.fireAlarmDevices, ownFloorWarnings, itemLabels.fireAlarmDevices),
    viewFilterNoteLines: viewFilterNote
      ? wrapViewFilterNoteLines(viewFilterNote, fontPx, options.image.widthPx, sidePaddingPx)
      : [],
    // M3 review fix: wrapped (never truncated), same routine the view-filter note uses.
    floorNoteLines: wrapLine(describeFloorPosition(options.floorPosition)),
    shaftsOnFloorLines: wrapLine(describeShaftsOnFloor(options.hubs, itemLabels.hubs, options.shafts, options.floorPosition?.count)),
  }
}
