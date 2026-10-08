/**
 * The PNG strip's "Shown: ... / Hidden: ..." note - drawn only when the view
 * config hides something, below the legend lines and above the BOM table.
 * It is the only record in the image of what is missing from the drawing,
 * so it is WRAPPED to the strip width, never truncated.
 */
import type { ViewFilterNote } from '../../domain/view/view-config-toggle-table'
import { wrapTextToWidth } from './wrap-text-to-width'

const MUTED_TEXT_COLOR = '#6b7280'
/** Taken off the wrap width: the lines are measured on a scratch context, then drawn on the export canvas. */
const WRAP_SLACK_PX = 2

const noteFont = (fontPx: number) => `${fontPx}px sans-serif`

/**
 * Wraps ONE plain text block to the strip width - the SAME routine the
 * "Shown / Hidden" note uses below, shared (M3 review fix) so the floor
 * note and the shafts-on-floor line (`build-export-legends.ts`) wrap
 * instead of silently overflowing or getting truncated. Measured at full
 * resolution - a downscaled export scales the font and the width together,
 * so the breaks stay valid. Without a 2D context (never in a real browser)
 * the text comes back as a single unwrapped line. Empty/blank text gives
 * no lines at all - the caller draws nothing (no line reserved either).
 */
export function wrapPlainTextToStripWidth(text: string, fontPx: number, stripWidthPx: number, sidePaddingPx: number): string[] {
  if (!text) return []
  if (typeof document === 'undefined') return [text]
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return [text]
  ctx.font = noteFont(fontPx)
  const maxWidthPx = stripWidthPx - sidePaddingPx * 2 - WRAP_SLACK_PX
  const measure = (t: string) => ctx.measureText(t).width
  return wrapTextToWidth(text, maxWidthPx, measure)
}

/**
 * The note as strip lines: "Shown" and "Hidden" are wrapped separately, so
 * "Hidden" always starts a new line.
 */
export function wrapViewFilterNoteLines(note: ViewFilterNote, fontPx: number, stripWidthPx: number, sidePaddingPx: number): string[] {
  return [
    ...wrapPlainTextToStripWidth(note.shownText, fontPx, stripWidthPx, sidePaddingPx),
    ...wrapPlainTextToStripWidth(note.hiddenText, fontPx, stripWidthPx, sidePaddingPx),
  ]
}

/** Draws one already-wrapped note line, left-aligned like the legend lines, in the muted note colour. */
export function drawViewFilterNoteLine(
  ctx: CanvasRenderingContext2D,
  lineCenterY: number,
  fontPx: number,
  cellPaddingPx: number,
  text: string,
): void {
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = noteFont(fontPx)
  ctx.fillStyle = MUTED_TEXT_COLOR
  ctx.fillText(text, cellPaddingPx, lineCenterY)
}
