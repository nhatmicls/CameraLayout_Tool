import type { BomRow } from '../../domain/bom/bill-of-materials-grouping'
import type { BomStripLayout } from '../../domain/export/export-image-layout-calculator'
import type { SensorKind } from '../../domain/sensor/sensor-types'
import { drawCableLegendLine, type CableLegend } from './draw-export-cable-legend-line'
import { drawCompatibilityWarningLine, drawFireAlarmLegendLine, type FireAlarmLegend } from './draw-export-fire-alarm-legend-lines'
import { drawDoriLegendLine, drawSensorLegendLine } from './draw-export-legend-lines'
import { drawViewFilterNoteLine } from './draw-export-view-filter-note'
import { drawBomTableRows } from './draw-bom-table-rows'

export interface BomStripContent {
  rows: BomRow[]
  /** e.g. "1 m = 42.0 px". */
  scaleNoteText: string
  /** e.g. "Exported 2026-10-05". */
  dateText: string
  hasApproximateDoriModel: boolean
  /** Kinds of placed sensors whose model is known, pir/beam/vibration/thermal order. Empty (the common case for a camera-only or sensor-free plan) draws only the DORI legend line - see `legendLineCountFor`. */
  sensorKindsPresent: SensorKind[]
  /** Null (a plan without cables) draws no cable legend line. */
  cableLegend: CableLegend | null
  /** Null (no fire-alarm device with a known model) draws no fire-alarm legend line. */
  fireAlarmLegend: FireAlarmLegend | null
  /** Null (no `checkFireAlarmCompatibility` warning) draws no compatibility-warning line. */
  compatibilityWarningText: string | null
  /** The view config's "Shown / Hidden" note, already wrapped to the strip width (`wrapViewFilterNoteLines`). Empty (nothing hidden) draws nothing. */
  viewFilterNoteLines: string[]
  /** "F2 of 3 - Level 2" (phase 7), already wrapped to the strip width (M3 review fix - never truncated). Empty on a one-floor project. */
  floorNoteLines: string[]
  /** "Shafts: T1 Main riser" (phase 7), already wrapped. Empty when there are none, or the project has one floor. */
  shaftsOnFloorLines: string[]
}

export const CELL_PADDING_RATIO = 0.4 // * fontPx, left padding inside each cell

/**
 * How many legend lines the strip draws: the DORI line, plus one when the
 * plan has a sensor whose model is known, plus one when it has cables, plus
 * one when it has a fire-alarm device whose model is known, plus one when
 * there is a compatibility warning, plus one per wrapped view-filter note
 * line. The ONE definition: the caller feeds
 * this to `computeBomStripLayout`, so the strip's reserved legend height and
 * what gets drawn into it cannot disagree.
 */
export function legendLineCountFor(
  content: Pick<
    BomStripContent,
    | 'sensorKindsPresent'
    | 'cableLegend'
    | 'fireAlarmLegend'
    | 'compatibilityWarningText'
    | 'viewFilterNoteLines'
    | 'floorNoteLines'
    | 'shaftsOnFloorLines'
  >,
): number {
  return (
    1 +
    content.floorNoteLines.length +
    content.shaftsOnFloorLines.length +
    (content.sensorKindsPresent.length > 0 ? 1 : 0) +
    (content.cableLegend ? 1 : 0) +
    (content.fireAlarmLegend ? 1 : 0) +
    (content.compatibilityWarningText ? 1 : 0) +
    content.viewFilterNoteLines.length
  )
}

/**
 * Draws the export strip below the plan: one to five legend lines (DORI
 * swatches + scale note + export date, a sensor-kind line when the plan has
 * sensors, a cable line when it has cables, a fire-alarm kind/coverage line
 * when it has fire-alarm devices, a compatibility-warning line when one
 * exists), then the wrapped "Shown / Hidden" view note when the view config
 * hides something, followed by the BOM table (same columns as `bomToTable` - also
 * used, with a trailing `Notes` column, by the CSV export's `bomToCsvTable` -
 * cameras, sensors, fire-alarm devices, then cables, one source so CSV and
 * PNG can never drift on the row data). `scale` is the export's overall downscale
 * factor (1 = full resolution): every metric here is the phase-3 `layout`
 * value times `scale`, so the strip shrinks in lockstep with the plan above
 * it instead of overflowing a downscaled canvas. Assumes the caller already
 * sized the destination canvas to fit `layout.stripHeightPx * scale` below
 * the plan.
 */
export function drawBomTableAndLegendStrip(
  ctx: CanvasRenderingContext2D,
  stripOriginY: number,
  widthPx: number,
  layout: BomStripLayout,
  scale: number,
  content: BomStripContent,
): void {
  const fontPx = layout.fontPx * scale
  const rowHeightPx = layout.rowHeightPx * scale
  const legendHeightPx = layout.legendHeightPx * scale
  const cellPaddingPx = fontPx * CELL_PADDING_RATIO

  // One row per `content.rows` entry, plus the header row.
  const totalHeightPx = legendHeightPx + rowHeightPx * (content.rows.length + 1)

  // Strip background (export output is always opaque white, never transparent).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, stripOriginY, widthPx, totalHeightPx)

  const legendLineHeightPx = legendHeightPx / legendLineCountFor(content)
  /** Centre Y of legend line `lineIndex` (0 = the DORI line). */
  const lineCenterY = (lineIndex: number) => stripOriginY + legendLineHeightPx * (lineIndex + 0.5)

  drawDoriLegendLine(
    ctx,
    lineCenterY(0),
    widthPx,
    fontPx,
    cellPaddingPx,
    content.scaleNoteText,
    content.dateText,
    content.hasApproximateDoriModel,
  )
  let nextLineIndex = 1
  for (const line of content.floorNoteLines) {
    drawViewFilterNoteLine(ctx, lineCenterY(nextLineIndex), fontPx, cellPaddingPx, line)
    nextLineIndex += 1
  }
  for (const line of content.shaftsOnFloorLines) {
    drawViewFilterNoteLine(ctx, lineCenterY(nextLineIndex), fontPx, cellPaddingPx, line)
    nextLineIndex += 1
  }
  if (content.sensorKindsPresent.length > 0) {
    drawSensorLegendLine(ctx, lineCenterY(nextLineIndex), widthPx, fontPx, cellPaddingPx, content.sensorKindsPresent)
    nextLineIndex += 1
  }
  if (content.cableLegend) {
    drawCableLegendLine(ctx, lineCenterY(nextLineIndex), widthPx, fontPx, cellPaddingPx, content.cableLegend)
    nextLineIndex += 1
  }
  if (content.fireAlarmLegend) {
    drawFireAlarmLegendLine(ctx, lineCenterY(nextLineIndex), widthPx, fontPx, cellPaddingPx, content.fireAlarmLegend)
    nextLineIndex += 1
  }
  if (content.compatibilityWarningText) {
    drawCompatibilityWarningLine(ctx, lineCenterY(nextLineIndex), widthPx, fontPx, cellPaddingPx, content.compatibilityWarningText)
    nextLineIndex += 1
  }
  for (const noteLine of content.viewFilterNoteLines) {
    drawViewFilterNoteLine(ctx, lineCenterY(nextLineIndex), fontPx, cellPaddingPx, noteLine)
    nextLineIndex += 1
  }

  drawBomTableRows(ctx, content.rows, stripOriginY + legendHeightPx, rowHeightPx, widthPx, cellPaddingPx, fontPx)
}
