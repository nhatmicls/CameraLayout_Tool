/**
 * The two stacked legend text lines drawn above the BOM table
 * (`draw-bom-table-and-legend-strip.ts`, split out here per the phase 7
 * file-size budget): line 1 (DORI swatches + scale/date, unchanged from the
 * pre-sensor strip) and line 2 (sensor kind swatches, only drawn when the
 * project has sensors). Kept as two separate exports rather than one
 * combined function so a sensor-free export never pays for - or risks
 * regressing - line 1's exact pixel layout.
 */
import { DORI_BAND_COLORS } from '../../canvas/shared/brand-and-dori-color-palette'
import { SENSOR_KIND_COLORS, THERMAL_DRI_BAND_COLORS } from '../../canvas/sensor/sensor-kind-color-palette'
import { SENSOR_KIND_LABELS, type SensorKind } from '../../domain/sensor/sensor-types'
import type { ThermalDriZone } from '../../domain/sensor/thermal-dri-band-calculator'
import { truncateCanvasTextToWidth } from './truncate-canvas-text-to-width'

const TEXT_COLOR = '#111827'
const MUTED_TEXT_COLOR = '#6b7280'

const DORI_LEGEND_ENTRIES: ReadonlyArray<{ zone: keyof typeof DORI_BAND_COLORS; label: string }> = [
  { zone: 'identify', label: 'Identify' },
  { zone: 'recognize', label: 'Recognize' },
  { zone: 'observe', label: 'Observe' },
  { zone: 'detect', label: 'Detect' },
  { zone: 'beyond-detect', label: 'Beyond detect' },
]

/** Line 1: DORI colour swatches + labels (left), scale note + export date (right). Byte-for-byte the pre-sensor legend line. */
export function drawDoriLegendLine(
  ctx: CanvasRenderingContext2D,
  lineCenterY: number,
  widthPx: number,
  fontPx: number,
  cellPaddingPx: number,
  scaleNoteText: string,
  dateText: string,
  hasApproximateDoriModel: boolean,
): void {
  const swatchSize = fontPx * 0.8

  ctx.textBaseline = 'middle'
  ctx.font = `${fontPx}px sans-serif`

  let x = cellPaddingPx
  for (const { zone, label } of DORI_LEGEND_ENTRIES) {
    ctx.fillStyle = DORI_BAND_COLORS[zone]
    ctx.fillRect(x, lineCenterY - swatchSize / 2, swatchSize, swatchSize)
    x += swatchSize + fontPx * 0.3

    ctx.fillStyle = TEXT_COLOR
    ctx.textAlign = 'left'
    ctx.fillText(label, x, lineCenterY)
    x += ctx.measureText(label).width + fontPx * 0.9
  }

  if (hasApproximateDoriModel) {
    ctx.font = `italic ${fontPx * 0.8}px sans-serif`
    ctx.fillStyle = MUTED_TEXT_COLOR
    const maxWidth = widthPx * 0.6 - x // leave room for the right-aligned scale/date text
    ctx.fillText(truncateCanvasTextToWidth(ctx, 'computed per EN 62676-4; fisheye approximate', Math.max(0, maxWidth)), x, lineCenterY)
  }

  ctx.font = `${fontPx}px sans-serif`
  ctx.fillStyle = MUTED_TEXT_COLOR
  ctx.textAlign = 'right'
  ctx.fillText(`${scaleNoteText}  ·  ${dateText}`, widthPx - cellPaddingPx, lineCenterY)
}

const THERMAL_DRI_LEGEND_ENTRIES: ReadonlyArray<{ zone: ThermalDriZone; label: string }> = [
  { zone: 'identify', label: 'Identify' },
  { zone: 'recognize', label: 'Recognize' },
  { zone: 'detect', label: 'Detect' },
]

/** Draws one swatch + its label at `x`, returns the x position just past the label (plus a gap), ready for the next entry. */
function drawSwatchAndLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  lineCenterY: number,
  swatchSize: number,
  fontPx: number,
  color: string,
  label: string,
): number {
  ctx.fillStyle = color
  ctx.fillRect(x, lineCenterY - swatchSize / 2, swatchSize, swatchSize)
  const textX = x + swatchSize + fontPx * 0.3
  ctx.fillStyle = TEXT_COLOR
  ctx.textAlign = 'left'
  ctx.fillText(label, textX, lineCenterY)
  return textX + ctx.measureText(label).width + fontPx * 0.9
}

/** Appends a muted note after the current x, truncated so it never pushes past `widthPx`. Returns the x position just past the note. */
function drawMutedNote(ctx: CanvasRenderingContext2D, x: number, lineCenterY: number, fontPx: number, widthPx: number, note: string): number {
  ctx.font = `italic ${fontPx * 0.8}px sans-serif`
  ctx.fillStyle = MUTED_TEXT_COLOR
  ctx.textAlign = 'left'
  const maxWidth = Math.max(0, widthPx - x - fontPx * 0.5)
  const text = truncateCanvasTextToWidth(ctx, note, maxWidth)
  ctx.fillText(text, x, lineCenterY)
  const nextX = x + ctx.measureText(text).width + fontPx * 0.6
  ctx.font = `${fontPx}px sans-serif`
  return nextX
}

/**
 * Line 2 (only drawn when the project has sensors): a swatch + label for
 * each sensor kind present, in a fixed pir/beam/vibration/thermal order.
 * Thermal draws its own three D/R/I swatches (never the DORI palette - a
 * thermal sensor must never show a DORI swatch, CLAUDE.md) plus a
 * "datasheet ranges" note; beam gets a "dashed = blocked or over max
 * distance" note, matching `sensor-beam-node.tsx`'s actual dash behaviour.
 */
export function drawSensorLegendLine(
  ctx: CanvasRenderingContext2D,
  lineCenterY: number,
  widthPx: number,
  fontPx: number,
  cellPaddingPx: number,
  sensorKindsPresent: readonly SensorKind[],
): void {
  const swatchSize = fontPx * 0.8
  ctx.textBaseline = 'middle'
  ctx.font = `${fontPx}px sans-serif`

  let x = cellPaddingPx
  for (const kind of sensorKindsPresent) {
    if (kind === 'thermal') {
      for (const { zone, label } of THERMAL_DRI_LEGEND_ENTRIES) {
        x = drawSwatchAndLabel(ctx, x, lineCenterY, swatchSize, fontPx, THERMAL_DRI_BAND_COLORS[zone], label)
      }
      x = drawMutedNote(ctx, x, lineCenterY, fontPx, widthPx, 'thermal: datasheet ranges')
      continue
    }

    x = drawSwatchAndLabel(ctx, x, lineCenterY, swatchSize, fontPx, SENSOR_KIND_COLORS[kind], SENSOR_KIND_LABELS[kind])
    if (kind === 'beam') {
      x = drawMutedNote(ctx, x, lineCenterY, fontPx, widthPx, 'dashed = blocked or over max distance')
    }
  }
}
