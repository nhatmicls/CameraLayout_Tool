/**
 * Pure layout math for the exported PNG: how tall the BOM strip below the
 * floor plan must be, and how much the whole canvas must be downscaled to
 * stay under a pixel-count / max-side limit (e.g. Safari's ~16.7M px cap).
 * No Konva/canvas calls here - e2e tests assert the exact strip height this
 * module returns.
 */
import { clamp } from '../shared/clamp'

const MIN_FONT_PX = 12
const MAX_FONT_PX = 28
/** Font size scales with image width so the strip stays legible on both small and huge exported plans. */
const FONT_WIDTH_RATIO = 0.012
const ROW_HEIGHT_FONT_RATIO = 1.8
/** Extra vertical space above the table for a title/legend line. */
const LEGEND_FONT_RATIO = 2.2

export interface BomStripLayout {
  fontPx: number
  rowHeightPx: number
  /** Total legend block height - one line's height times `legendLineCount`. */
  legendHeightPx: number
  /** Total strip height: legend + one row per BOM entry + one header row. */
  stripHeightPx: number
}

/**
 * Computes the BOM strip's font size and total height for a given export
 * width and row count. `legendLineCount` (default 1) is the number of
 * stacked legend text lines above the table: 1 for the DORI/scale line
 * alone, 2 when the project also has sensors (a second line for the sensor
 * kind legend, added only then - see `drawExportLegendLines`). Default
 * (1 line) is byte-for-byte the pre-sensor formula, so a sensor-free export
 * keeps its exact strip height; `legendHeightPx` scales linearly with the
 * line count, so 2 lines adds exactly one more line's height to the total.
 */
export function computeBomStripLayout(imageWidthPx: number, bomRowCount: number, legendLineCount = 1): BomStripLayout {
  if (!Number.isFinite(imageWidthPx) || imageWidthPx <= 0) {
    throw new Error(`imageWidthPx must be a positive finite number, got ${imageWidthPx}`)
  }
  if (!Number.isFinite(bomRowCount) || bomRowCount < 0) {
    throw new Error(`bomRowCount must be a non-negative finite number, got ${bomRowCount}`)
  }
  if (!Number.isInteger(legendLineCount) || legendLineCount < 1) {
    throw new Error(`legendLineCount must be a positive integer, got ${legendLineCount}`)
  }

  const fontPx = Math.round(clamp(imageWidthPx * FONT_WIDTH_RATIO, MIN_FONT_PX, MAX_FONT_PX))
  const rowHeightPx = Math.round(fontPx * ROW_HEIGHT_FONT_RATIO)
  const legendHeightPx = Math.round(fontPx * LEGEND_FONT_RATIO) * legendLineCount
  // +1 row accounts for the table's own header row (Brand/Model/.../Labels).
  const stripHeightPx = legendHeightPx + rowHeightPx * (bomRowCount + 1)

  return { fontPx, rowHeightPx, legendHeightPx, stripHeightPx }
}

/**
 * Scale factor (<= 1, never upscales) that keeps both the longest side under
 * `maxSidePx` and the total pixel area under `maxPixels`.
 */
export function computeExportScale(
  widthPx: number,
  totalHeightPx: number,
  maxPixels: number,
  maxSidePx: number,
): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(totalHeightPx) || totalHeightPx <= 0) {
    throw new Error('widthPx and totalHeightPx must be positive finite numbers')
  }

  let scale = 1

  const longestSidePx = Math.max(widthPx, totalHeightPx)
  if (longestSidePx > maxSidePx) {
    scale = Math.min(scale, maxSidePx / longestSidePx)
  }

  const area = widthPx * totalHeightPx
  if (area * scale * scale > maxPixels) {
    scale = Math.min(scale, Math.sqrt(maxPixels / area))
  }

  return scale
}
