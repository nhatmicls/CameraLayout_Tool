/**
 * Truncates `text` with a trailing ellipsis so it fits within `maxWidthPx`
 * at the context's current font. Binary search over character count - cheap
 * and exact for proportional fonts. Shared by the BOM table cells and both
 * legend lines (moved out of `draw-bom-table-and-legend-strip.ts` so the
 * legend-line drawing code can use it too without a circular import).
 */
export function truncateCanvasTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number): string {
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
