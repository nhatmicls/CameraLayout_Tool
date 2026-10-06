import { bomToTable, formatVndNumber, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import type { BomStripLayout } from '../../domain/export/export-image-layout-calculator'
import type { SensorKind } from '../../domain/sensor/sensor-types'
import { drawDoriLegendLine, drawSensorLegendLine } from './draw-export-legend-lines'
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
}

// Type, Brand, Model, Form Factor, Resolution, Lens, Quantity, Labels, Unit Price, Total - sums to 1, proportional to strip
// width so the table never clips at any export size. Tuned (phase 7 manual verification at 1200px/6000px-wide exports)
// against the two longest headers - "Quantity" and "Unit Price (VND)" - which clipped to "Qua…" / "Unit Price (…" at the
// plan's originally proposed weights; Model/Resolution/Labels keep extra room for long data cells (catalog model numbers,
// multi-item label lists) even though those are allowed to truncate with an ellipsis, unlike a header.
const COLUMN_WEIGHTS = [0.06, 0.07, 0.16, 0.09, 0.14, 0.07, 0.07, 0.11, 0.13, 0.1]

const TEXT_COLOR = '#111827'
const GRID_LINE_COLOR = '#d4d4d8'
const HEADER_FILL_COLOR = '#f4f4f5'
const CELL_PADDING_RATIO = 0.4 // * fontPx, left padding inside each cell

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

/** 2 lines (DORI + sensor) when the plan has any sensor whose model is known; 1 (DORI only) otherwise - must mirror whatever line count the caller fed `computeBomStripLayout`, so the strip's reserved legend height and what actually gets drawn into it never disagree. */
function legendLineCountFor(content: BomStripContent): number {
  return content.sensorKindsPresent.length > 0 ? 2 : 1
}

/**
 * Draws the export strip below the plan: one or two legend lines (DORI
 * swatches + scale note + export date, plus a sensor-kind line when the
 * plan has sensors) followed by the BOM table (same columns as the CSV
 * export's `bomToTable`, phase 3/7 - cameras then sensors, one source so
 * CSV and PNG can never drift). `scale` is the export's overall downscale
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

  const legendLineCount = legendLineCountFor(content)
  const legendLineHeightPx = legendHeightPx / legendLineCount

  drawDoriLegendLine(
    ctx,
    stripOriginY + legendLineHeightPx / 2,
    widthPx,
    fontPx,
    cellPaddingPx,
    content.scaleNoteText,
    content.dateText,
    content.hasApproximateDoriModel,
  )
  if (legendLineCount > 1) {
    drawSensorLegendLine(
      ctx,
      stripOriginY + legendLineHeightPx + legendLineHeightPx / 2,
      widthPx,
      fontPx,
      cellPaddingPx,
      content.sensorKindsPresent,
    )
  }

  let rowTop = stripOriginY + legendHeightPx
  drawTableRow(ctx, header, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, true)
  for (const row of dataRows) {
    rowTop += rowHeightPx
    drawTableRow(ctx, row, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, false)
  }
}
