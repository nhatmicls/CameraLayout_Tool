import { describe, expect, it } from 'vitest'
import {
  calibrationWarnings,
  computePlanPxPerMeter,
  metersToPlanPx,
  planPxToMeters,
  type RefLine,
} from './scale-calibration-calculator'

describe('computePlanPxPerMeter', () => {
  it('500px line = 5m -> 100 px/m', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 500, y2: 0 }
    expect(computePlanPxPerMeter(line, 5)).toBeCloseTo(100, 6)
  })

  it('handles a diagonal line via hypotenuse length', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 300, y2: 400 } // 3-4-5 triangle, length 500
    expect(computePlanPxPerMeter(line, 5)).toBeCloseTo(100, 6)
  })

  it('rejects a zero-length line', () => {
    const line: RefLine = { x1: 10, y1: 10, x2: 10, y2: 10 }
    expect(() => computePlanPxPerMeter(line, 5)).toThrow()
  })

  it('rejects zero, negative, or NaN length', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 100, y2: 0 }
    expect(() => computePlanPxPerMeter(line, 0)).toThrow()
    expect(() => computePlanPxPerMeter(line, -5)).toThrow()
    expect(() => computePlanPxPerMeter(line, NaN)).toThrow()
    expect(() => computePlanPxPerMeter(line, Infinity)).toThrow()
  })
})

describe('calibrationWarnings', () => {
  it('warns on a short line (< 200px)', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 100, y2: 0 }
    const warnings = calibrationWarnings(line, 5)
    expect(warnings.map((w) => w.code)).toContain('short-line')
  })

  it('warns on a short stated length (< 1m)', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 500, y2: 0 }
    const warnings = calibrationWarnings(line, 0.5)
    expect(warnings.map((w) => w.code)).toContain('short-length')
  })

  it('no warnings for a well-conditioned calibration', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 500, y2: 0 }
    expect(calibrationWarnings(line, 5)).toHaveLength(0)
  })

  it('can produce both warnings at once', () => {
    const line: RefLine = { x1: 0, y1: 0, x2: 50, y2: 0 }
    const warnings = calibrationWarnings(line, 0.3)
    expect(warnings).toHaveLength(2)
  })
})

describe('metersToPlanPx / planPxToMeters round trip', () => {
  it('round-trips through both conversions', () => {
    const planPxPerMeter = 100
    expect(metersToPlanPx(5, planPxPerMeter)).toBeCloseTo(500, 6)
    expect(planPxToMeters(500, planPxPerMeter)).toBeCloseTo(5, 6)
    expect(planPxToMeters(metersToPlanPx(12.5, planPxPerMeter), planPxPerMeter)).toBeCloseTo(12.5, 6)
  })
})
