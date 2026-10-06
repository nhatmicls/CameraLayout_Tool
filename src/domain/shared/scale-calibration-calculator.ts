/**
 * Converts a user-drawn calibration line (in image pixels, with a stated
 * real-world length) into `planPxPerMeter` - the image-scale factor. This is
 * unrelated to `DORI_PX_PER_METER`; never mix the two names.
 */

export interface RefLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Below this many image px, a 1-2px click error at each endpoint is a >2% length error. */
const SHORT_LINE_PX_THRESHOLD = 200
/** Below this many real-world metres, rounding the stated length amplifies error similarly. */
const SHORT_LENGTH_M_THRESHOLD = 1

function lineLengthPx(line: RefLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
}

/** Plan image pixels per metre, from a calibration line of known real-world length (m). */
export function computePlanPxPerMeter(line: RefLine, lengthM: number): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0) {
    throw new Error(`lengthM must be a positive finite number, got ${lengthM}`)
  }
  const pxLen = lineLengthPx(line)
  if (!Number.isFinite(pxLen) || pxLen <= 0) {
    throw new Error('calibration line must have non-zero length')
  }
  return pxLen / lengthM
}

export interface CalibrationWarning {
  code: 'short-line' | 'short-length'
  message: string
}

/** Non-fatal warnings for a calibration input that is technically valid but error-prone. */
export function calibrationWarnings(line: RefLine, lengthM: number): CalibrationWarning[] {
  const warnings: CalibrationWarning[] = []
  const pxLen = lineLengthPx(line)

  if (pxLen < SHORT_LINE_PX_THRESHOLD) {
    warnings.push({
      code: 'short-line',
      message: `Calibration line is only ${pxLen.toFixed(0)}px; lines under ${SHORT_LINE_PX_THRESHOLD}px amplify click error.`,
    })
  }
  if (Number.isFinite(lengthM) && lengthM > 0 && lengthM < SHORT_LENGTH_M_THRESHOLD) {
    warnings.push({
      code: 'short-length',
      message: `Calibration length is ${lengthM}m; lengths under ${SHORT_LENGTH_M_THRESHOLD}m amplify rounding error.`,
    })
  }
  return warnings
}

/** Metres -> plan image pixels, using the calibrated scale. */
export function metersToPlanPx(meters: number, planPxPerMeter: number): number {
  return meters * planPxPerMeter
}

/** Plan image pixels -> metres, using the calibrated scale. */
export function planPxToMeters(px: number, planPxPerMeter: number): number {
  return px / planPxPerMeter
}
