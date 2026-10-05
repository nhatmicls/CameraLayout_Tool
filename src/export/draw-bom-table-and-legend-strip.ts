import { bomToTable, formatVndNumber, type BomRow } from '../domain/bill-of-materials-grouping'
import type { BomStripLayout } from '../domain/export-image-layout-calculator'
import { DORI_BAND_COLORS } from '../canvas/brand-and-dori-color-palette'

export interface BomStripContent {
  rows: BomRow[]
  /** e.g. "1 m = 42.0 px". */
  scaleNoteText: string
  /** e.g. "Exported 2026-10-05". */
  dateText: string
  hasApproximateDoriModel: boolean
}

const DORI_LEGEND_ENTRIES: ReadonlyArray<{ zone: keyof typeof DORI_BAND_COLORS; label: string }> = [
  { zone: 'identify', label: 'Identify' },
  { zone: 'recognize', label: 'Recognize' },
  { zone: 'observe', label: 'Observe' },
  { zone: 'detect', label: 'Detect' },
  { zone: 'beyond-detect', label: 'Beyond detect' },
]

// Brand, Model, Form Factor, Resolution, Lens, Quantity, Cameras, Unit Price, Total - sums to 1, proportional to strip width so the table never clips at any export size.
const COLUMN_WEIGHTS = [0.1, 0.18, 0.1, 0.15, 0.09, 0.06, 0.12, 0.1, 0.1]

const TEXT_COLOR = '#111827'
const MUTED_TEXT_COLOR = '#6b7280'
const GRID_LINE_COLOR = '#d4d4d8'
const HEADER_FILL_COLOR = '#f4f4f5'
const CELL_PADDING_RATIO = 0.4 // * fontPx, left padding inside each cell

/** Truncates `text` with a trailing ellipsis so it fits within `maxWidthPx` at the context's current font. Binary search over character count - cheap and exact for proportional fonts. */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number): string {
  if (ctx.measureText(text).width <= maxWidthPx) return text

  const ellipsis = '…'
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = text.slice(0, mid) + ellipsis
    if (ctx.measureText(candidate).width <= maxWidthPx) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis
}

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
    ctx.fillText(truncateToWidth(ctx, cell, maxTextWidth), x0 + cellPaddingPx, centerY)
  })

  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, rowTop + rowHeightPx)
  ctx.lineTo(widthPx, rowTop + rowHeightPx)
  ctx.stroke()
}

/** Single legend line: DORI colour swatches + labels (left), scale note + export date (right). Everything on one baseline - `legendHeightPx` only has room for one text line at any clamped font size. */
function drawLegendLine(
  ctx: CanvasRenderingContext2D,
  stripOriginY: number,
  widthPx: number,
  legendHeightPx: number,
  fontPx: number,
  cellPaddingPx: number,
  content: BomStripContent,
): void {
  const legendY = stripOriginY + legendHeightPx / 2
  const swatchSize = fontPx * 0.8

  ctx.textBaseline = 'middle'
  ctx.font = `${fontPx}px sans-serif`

  let x = cellPaddingPx
  for (const { zone, label } of DORI_LEGEND_ENTRIES) {
    ctx.fillStyle = DORI_BAND_COLORS[zone]
    ctx.fillRect(x, legendY - swatchSize / 2, swatchSize, swatchSize)
    x += swatchSize + fontPx * 0.3

    ctx.fillStyle = TEXT_COLOR
    ctx.textAlign = 'left'
    ctx.fillText(label, x, legendY)
    x += ctx.measureText(label).width + fontPx * 0.9
  }

  if (content.hasApproximateDoriModel) {
    ctx.font = `italic ${fontPx * 0.8}px sans-serif`
    ctx.fillStyle = MUTED_TEXT_COLOR
    const maxWidth = widthPx * 0.6 - x // leave room for the right-aligned scale/date text
    ctx.fillText(truncateToWidth(ctx, 'computed per EN 62676-4; fisheye approximate', Math.max(0, maxWidth)), x, legendY)
  }

  ctx.font = `${fontPx}px sans-serif`
  ctx.fillStyle = MUTED_TEXT_COLOR
  ctx.textAlign = 'right'
  ctx.fillText(`${content.scaleNoteText}  ·  ${content.dateText}`, widthPx - cellPaddingPx, legendY)
}

/**
 * Draws the export strip below the plan: one legend line (DORI swatches +
 * scale note + export date) followed by the BOM table (same columns as the
 * CSV export's `bomToTable`, phase 3). `scale` is the export's overall
 * downscale factor (1 = full resolution): every metric here is the phase-3
 * `layout` value times `scale`, so the strip shrinks in lockstep with the
 * plan above it instead of overflowing a downscaled canvas. Assumes the
 * caller already sized the destination canvas to fit `layout.stripHeightPx
 * * scale` below the plan.
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

  drawLegendLine(ctx, stripOriginY, widthPx, legendHeightPx, fontPx, cellPaddingPx, content)

  let rowTop = stripOriginY + legendHeightPx
  drawTableRow(ctx, header, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, true)
  for (const row of dataRows) {
    rowTop += rowHeightPx
    drawTableRow(ctx, row, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, false)
  }
}
