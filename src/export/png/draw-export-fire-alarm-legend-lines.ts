/**
 * The PNG strip's two fire-alarm legend lines (split out from
 * `draw-export-legend-lines.ts` per the phase-8 plan, rather than growing
 * that file): the kind-counts + coverage-basis line, and the
 * compatibility-warning line. Both are null-able on `BomStripContent` -
 * `null` draws nothing, same pattern as `CableLegend`.
 */
import { FIRE_ALARM_KIND_LABELS, type FireAlarmKind } from '../../domain/fire-alarm/fire-alarm-device-types'
import { truncateCanvasTextToWidth } from './truncate-canvas-text-to-width'

export interface FireAlarmLegend {
  /** Kinds present among devices with a known catalog model, in `FIRE_ALARM_KIND_DISPLAY_ORDER`, each with its placed count. */
  kindCounts: { kind: FireAlarmKind; count: number }[]
  /** e.g. "coverage: TCVN 5738:2021 at h = 3.2 m, equal-area circle, approximation" - null when no detector actually draws a circle (datasheet mode, no ceiling height, height above the table, or no scale) - never claim a basis for a line with no drawn circle. */
  coverageBasisText: string | null
}

const TEXT_COLOR = '#111827'
const MUTED_TEXT_COLOR = '#6b7280'
/** The amber-700 Tailwind shade used for the matching panel/properties-panel warning text - keeps the PNG legend's warning colour consistent with the live UI. */
const WARNING_TEXT_COLOR = '#b45309'

function pluralLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

/** Draws "Fire alarm: 2 Smoke detectors, 1 Wireless hub" (left) plus the coverage-basis note (muted, right of the kind list) when one is given. */
export function drawFireAlarmLegendLine(
  ctx: CanvasRenderingContext2D,
  lineCenterY: number,
  widthPx: number,
  fontPx: number,
  cellPaddingPx: number,
  legend: FireAlarmLegend,
): void {
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `${fontPx}px sans-serif`
  ctx.fillStyle = TEXT_COLOR

  let x = cellPaddingPx
  const prefix = 'Fire alarm:'
  ctx.fillText(prefix, x, lineCenterY)
  x += ctx.measureText(prefix).width + fontPx * 0.4

  const kindsText = legend.kindCounts.map(({ kind, count }) => pluralLabel(count, FIRE_ALARM_KIND_LABELS[kind])).join(', ')
  const kindsMaxWidth = widthPx * 0.55 - x
  const truncatedKinds = truncateCanvasTextToWidth(ctx, kindsText, Math.max(0, kindsMaxWidth))
  ctx.fillText(truncatedKinds, x, lineCenterY)
  x += ctx.measureText(truncatedKinds).width + fontPx * 0.6

  if (legend.coverageBasisText) {
    ctx.font = `italic ${fontPx * 0.8}px sans-serif`
    ctx.fillStyle = MUTED_TEXT_COLOR
    const noteMaxWidth = widthPx - cellPaddingPx - x
    ctx.fillText(truncateCanvasTextToWidth(ctx, legend.coverageBasisText, Math.max(0, noteMaxWidth)), x, lineCenterY)
  }
}

/** Draws one compatibility-warning line, truncated to fit - the warning colour matches the BOM panel's warning block and the properties panel's warning status line. */
export function drawCompatibilityWarningLine(
  ctx: CanvasRenderingContext2D,
  lineCenterY: number,
  widthPx: number,
  fontPx: number,
  cellPaddingPx: number,
  text: string,
): void {
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `${fontPx}px sans-serif`
  ctx.fillStyle = WARNING_TEXT_COLOR
  const maxWidth = widthPx - cellPaddingPx * 2
  ctx.fillText(truncateCanvasTextToWidth(ctx, text, Math.max(0, maxWidth)), cellPaddingPx, lineCenterY)
}
