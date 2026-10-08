import { bomToTable, formatVndNumber, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { truncateCanvasTextToWidth } from './truncate-canvas-text-to-width'

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
 * Draws the BOM table (header + one row per `rows` entry) starting at
 * `startTopPx`, same columns as `bomToTable` (also used, with a trailing
 * `Notes` column, by the CSV export's `bomToCsvTable` - one source so CSV
 * and PNG can never drift on the row data). Split out of
 * `draw-bom-table-and-legend-strip.ts` to keep that file under 200 lines.
 */
export function drawBomTableRows(
  ctx: CanvasRenderingContext2D,
  rows: readonly BomRow[],
  startTopPx: number,
  rowHeightPx: number,
  widthPx: number,
  cellPaddingPx: number,
  fontPx: number,
): void {
  const [header, ...dataRows] = bomToTable([...rows], formatVndNumber)
  let rowTop = startTopPx
  drawTableRow(ctx, header, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, true)
  for (const row of dataRows) {
    rowTop += rowHeightPx
    drawTableRow(ctx, row, rowTop, rowHeightPx, widthPx, cellPaddingPx, fontPx, false)
  }
}
