import { cableTypeColor } from '../../canvas/cable/cable-type-color-palette'
import type { CableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import type { Cable, CableSettings, CableType } from '../../domain/cable/cable-layout-types'
import { formatCableEstimateNote } from '../../domain/cable/cable-length-format'
import { isCableTypeInUse } from '../../domain/cable/cable-reference-integrity'
import { describeUnestimatedCables } from '../../domain/cable/unestimated-cables-summary'
import { truncateCanvasTextToWidth } from './truncate-canvas-text-to-width'

/** The cable legend line of the PNG strip; null on the strip content = the plan has no cables, so no line is drawn. */
export interface CableLegend {
  /** The cable types in use, each with its line colour. */
  types: { name: string; color: string }[]
  /** True when a cable is drawn dashed (over, or possibly over, its type's length limit). */
  hasDashedCable: boolean
  /** True when this floor has at least one hub with a drawn trunk - adds the "dotted = route to hub" note, space permitting. */
  hasTrunkRoute: boolean
  /** "Cable lengths are provisional estimates: ..."; empty when there are no metres. */
  noteText: string
}

const TEXT_COLOR = '#111827'
const MUTED_TEXT_COLOR = '#6b7280'
/** The type swatches never take more than this share of the line, so the provisional-estimate note always has room. */
const TYPES_MAX_WIDTH_FRACTION = 0.5
const DASHED_NOTE = 'dashed = over / possibly over length limit'
const TRUNK_NOTE = 'dotted = route to hub'

export function buildCableLegend(
  cables: readonly Cable[],
  cableTypes: readonly CableType[],
  cableSettings: CableSettings,
  estimate: CableLayoutEstimate,
  /** Hubs are a per-floor-only concern upstream of this legend - the caller resolves "does this floor have a trunk" and just passes the bit. Default false (every pre-phase-5 call site unaffected). */
  hasTrunkRoute = false,
): CableLegend | null {
  // A trunk-only floor with no cables yet still skips the whole legend line (no provisional-
  // estimate note to anchor it either): documented as "skip, don't complicate" rather than
  // growing a cables-free variant of this line for what is normally a paired feature.
  if (cables.length === 0) return null
  // The note quotes the same whole metres the BOM rows add up to (each type is rounded up on its own).
  const wholeM = estimate.totals.reduce((sum, total) => sum + total.purchaseWholeM, 0)
  const { grandPurchase } = estimate
  const noteInterval = grandPurchase && { ...grandPurchase, nominal: wholeM, max: grandPurchase.max === null ? null : Math.max(grandPurchase.max, wholeM) }
  const provisionalNote = noteInterval ? formatCableEstimateNote(noteInterval, cableSettings.wastePercent) : ''
  // HIGH fix: a cross-floor cable excluded from the estimate (unscaled partner floor, a link
  // cycle) must never just silently print a shorter total - same wording the BOM panel and the
  // CSV export notification use.
  const unestimatedNote = describeUnestimatedCables(estimate.unestimatedCableCount, estimate.warnings) ?? ''
  return {
    types: cableTypes.flatMap((type, i) => (isCableTypeInUse(cables, type.id) ? [{ name: type.name, color: cableTypeColor(i) }] : [])),
    hasDashedCable: estimate.cables.some((cable) => cable.limitStatus === 'over' || cable.limitStatus === 'maybe-over'),
    hasTrunkRoute,
    noteText: [unestimatedNote, provisionalNote].filter(Boolean).join('  ·  '),
  }
}

/**
 * Draws the cable legend line: a line swatch + name per cable type in use
 * (left, stopping with an ellipsis at half the width), the dashed-line note,
 * and the provisional-estimate note right-aligned in whatever width is
 * left - truncated to fit, never drawn over the swatches.
 */
export function drawCableLegendLine(
  ctx: CanvasRenderingContext2D,
  lineCenterY: number,
  widthPx: number,
  fontPx: number,
  cellPaddingPx: number,
  legend: CableLegend,
): void {
  const swatchWidth = fontPx * 1.2
  const gap = fontPx * 0.9
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `${fontPx}px sans-serif`

  let x = cellPaddingPx
  const typesMaxX = widthPx * TYPES_MAX_WIDTH_FRACTION
  for (const [i, type] of legend.types.entries()) {
    const nameWidth = ctx.measureText(type.name).width
    if (i > 0 && x + swatchWidth + fontPx * 0.3 + nameWidth > typesMaxX) {
      ctx.fillStyle = MUTED_TEXT_COLOR
      ctx.fillText('…', x, lineCenterY)
      x += ctx.measureText('…').width + gap
      break
    }
    // A short thick line, not a square: cables are lines on the plan.
    ctx.fillStyle = type.color
    ctx.fillRect(x, lineCenterY - fontPx * 0.1, swatchWidth, fontPx * 0.2)
    x += swatchWidth + fontPx * 0.3
    const name = truncateCanvasTextToWidth(ctx, type.name, Math.max(0, typesMaxX - x))
    ctx.fillStyle = TEXT_COLOR
    ctx.fillText(name, x, lineCenterY)
    x += ctx.measureText(name).width + gap
  }

  const rightEdge = widthPx - cellPaddingPx
  if (legend.hasDashedCable) {
    ctx.font = `italic ${fontPx * 0.8}px sans-serif`
    ctx.fillStyle = MUTED_TEXT_COLOR
    const note = truncateCanvasTextToWidth(ctx, DASHED_NOTE, Math.max(0, rightEdge - x))
    ctx.fillText(note, x, lineCenterY)
    x += ctx.measureText(note).width + gap
    ctx.font = `${fontPx}px sans-serif`
  }

  // Only when there is real room left (not just enough for an ellipsis) - otherwise skipped
  // entirely rather than fighting the dashed note and the provisional-estimate note for space.
  if (legend.hasTrunkRoute && rightEdge - x > fontPx * 4) {
    ctx.font = `italic ${fontPx * 0.8}px sans-serif`
    ctx.fillStyle = MUTED_TEXT_COLOR
    const note = truncateCanvasTextToWidth(ctx, TRUNK_NOTE, Math.max(0, rightEdge - x))
    ctx.fillText(note, x, lineCenterY)
    x += ctx.measureText(note).width + gap
    ctx.font = `${fontPx}px sans-serif`
  }

  const noteMaxWidth = rightEdge - x
  if (legend.noteText && noteMaxWidth > fontPx * 2) {
    ctx.fillStyle = MUTED_TEXT_COLOR
    ctx.textAlign = 'right'
    ctx.fillText(truncateCanvasTextToWidth(ctx, legend.noteText, noteMaxWidth), rightEdge, lineCenterY)
  }
}
