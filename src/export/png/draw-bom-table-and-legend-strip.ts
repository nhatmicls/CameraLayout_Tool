import { bomToTable, formatVndNumber, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import type { BomStripLayout } from '../../domain/export/export-image-layout-calculator'
import type { SensorKind } from '../../domain/sensor/sensor-types'
import { drawCableLegendLine, type CableLegend } from './draw-export-cable-legend-line'
import { drawCompatibilityWarningLine, drawFireAlarmLegendLine, type FireAlarmLegend } from './draw-export-fire-alarm-legend-lines'
import { drawDoriLegendLine, drawSensorLegendLine } from './draw-export-legend-lines'
import { drawViewFilterNoteLine } from './draw-export-view-filter-note'
import { truncateCanvasTextToWidth } from './truncate-canvas-text-to-width'

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
}

// Type, Brand, Model, Form Factor, Resolution, Lens, Quantity, Unit, Labels, Unit Price, Total - sums to 1, proportional to
// strip width so the table never clips at any export size (one weight per `bomToTable` column - tested). Tuned (manual
// verification at 1200px/6000px-wide exports) against the two longest headers - "Quantity" and "Unit Price (VND)" - which
// clipped to "Qua…" / "Unit Price (…" at narrower weights, so those two are never shrunk. Type stays at 0.06: at 0.05 a
// 1200px export clipped "Camera" to "Cam…". The Unit column's 0.04 came out of Model, Resolution and Labels, which keep
// extra room for long data cells (catalog model numbers, multi-item label lists) even though those are allowed to
// truncate with an ellipsis, unlike a header.
export const COLUMN_WEIGHTS = [0.06, 0.07, 0.14, 0.09, 0.13, 0.07, 0.07, 0.04, 0.1, 0.13, 0.1]

const TEXT_COLOR = '#111827'
const GRID_LINE_COLOR = '#d4d4d8'
const HEADER_FILL_COLOR = '#f4f4f5'
export const CELL_PADDING_RATIO = 0.4 // * fontPx, left padding inside each cell

/** Left-edge x of column `columnIndex` (and the right edge of the table when passed `COLUMN_WEIGHTS.length`), as a fraction of `widthPx`. */
function columnX(widthPx: number, columnIndex: number): number {
  const fraction = COLUMN_WEIGHTS.slice(0, columnIndex).reduce((sum, w) => sum + w, 0)
  return widthPx * fraction
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  cells: readonly string[],
  rowTop: number,
  rowHeightPx: number,
  widthPx: number,
  cellPaddingPx: number,
  fontPx: number,
  isHeader: boolean,
): void {
  const centerY = rowTop + rowHeightPx / 2

  ctx.fillStyle = isHeader ? HEADER_FILL_COLOR : '#ffffff'
  ctx.fillRect(0, rowTop, widthPx, rowHeightPx)

  ctx.font = isHeader ? `bold ${fontPx}px sans-serif` : `${fontPx}px sans-serif`
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  cells.forEach((cell, columnIndex) => {
    const x0 = columnX(widthPx, columnIndex)
    const x1 = columnX(widthPx, columnIndex + 1)
    const maxTextWidth = x1 - x0 - cellPaddingPx * 2
    ctx.fillText(truncateCanvasTextToWidth(ctx, cell, maxTextWidth), x0 + cellPaddingPx, centerY)
  })

  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, rowTop + rowHeightPx)
  ctx.lineTo(widthPx, rowTop + rowHeightPx)
  ctx.stroke()
}

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
    'sensorKindsPresent' | 'cableLegend' | 'fireAlarmLegend' | 'compatibilityWarningText' | 'viewFilterNoteLines'
  >,
): number {
  return (
    1 +
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

  const [header, ...dataRows] = bomToTable(content.rows, formatVndNumber)
  const totalHeightPx = legendHeightPx + rowHeightPx * (dataRows.length + 1)

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

  let rowTop = stripOriginY + legendHeightPx
  drawTableRow(ctx, header, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, true)
  for (const row of dataRows) {
    rowTop += rowHeightPx
    drawTableRow(ctx, row, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, false)
  }
}
