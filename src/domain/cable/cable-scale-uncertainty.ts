import type { ScaleCalibration } from '../project-file/project-types'

/**
 * The scale-error range: each calibration click may be `e` px off, so the
 * true reference length in px lies within `Lref +- 2e`. Measured too short
 * => the real route is shorter: `min = horizM * Lref/(Lref+2e)`, `max =
 * horizM * Lref/(Lref-2e)`. Split out of `cable-length-estimate-calculator.ts`
 * to keep that file under 200 lines (the plan's own fallback for this case).
 */
export interface ScaleUncertainty {
  refLengthPx: number
  /** 2e / Lref. */
  relativeError: number
  minFactor: number | null
  maxFactor: number | null
  /** The interval is undefined, or the relative error is above `SCALE_UNRELIABLE_RELATIVE_ERROR`. */
  isUnreliable: boolean
}

export const SCALE_UNRELIABLE_RELATIVE_ERROR = 0.05

export function computeScaleUncertainty(scale: ScaleCalibration, clickErrorPx: number): ScaleUncertainty {
  const { x1, y1, x2, y2 } = scale.refLine
  const refLengthPx = Math.hypot(x2 - x1, y2 - y1)
  const spreadPx = 2 * clickErrorPx
  const relativeError = spreadPx / refLengthPx
  // Lref <= 2e: the true length could be zero, so no upper bound exists.
  if (!(refLengthPx > spreadPx)) {
    return { refLengthPx, relativeError, minFactor: null, maxFactor: null, isUnreliable: true }
  }
  return {
    refLengthPx,
    relativeError,
    minFactor: refLengthPx / (refLengthPx + spreadPx),
    maxFactor: refLengthPx / (refLengthPx - spreadPx),
    isUnreliable: relativeError > SCALE_UNRELIABLE_RELATIVE_ERROR,
  }
}
