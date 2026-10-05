import { describe, expect, it } from 'vitest'
import { computeDoriDistancesM, isApproximateDoriModel } from './dori-zone-distance-calculator'

// Hand-verified expectations (phase-03 plan, 2026-10-05). The geometry
// research report's worked-example table was arithmetically wrong and must
// not be used - these values override it.
const TOLERANCE_M = 0.05

describe('computeDoriDistancesM - rectilinear model (HFOV < 180)', () => {
  it('2688px / 82.4deg', () => {
    const d = computeDoriDistancesM(2688, 82.4)
    expect(d.detect).toBeCloseTo(61.41, 1)
    expect(Math.abs(d.detect - 61.41)).toBeLessThan(TOLERANCE_M)
    expect(Math.abs(d.observe - 24.56)).toBeLessThan(TOLERANCE_M)
    expect(Math.abs(d.recognize - 12.28)).toBeLessThan(TOLERANCE_M)
    expect(Math.abs(d.identify - 6.14)).toBeLessThan(TOLERANCE_M)
  })

  it('2688px / 111deg', () => {
    const d = computeDoriDistancesM(2688, 111)
    expect(Math.abs(d.detect - 36.95)).toBeLessThan(TOLERANCE_M)
    expect(Math.abs(d.identify - 3.7)).toBeLessThan(TOLERANCE_M)
  })

  it('3840px / 110deg', () => {
    const d = computeDoriDistancesM(3840, 110)
    expect(Math.abs(d.detect - 53.78)).toBeLessThan(TOLERANCE_M)
    expect(Math.abs(d.identify - 5.38)).toBeLessThan(TOLERANCE_M)
  })

  it('1920px / 30deg', () => {
    const d = computeDoriDistancesM(1920, 30)
    expect(Math.abs(d.detect - 143.31)).toBeLessThan(TOLERANCE_M)
    expect(Math.abs(d.identify - 14.33)).toBeLessThan(TOLERANCE_M)
  })

  it('identify = detect / 10 invariant holds for any valid input', () => {
    for (const [pixelWidth, hfovDeg] of [
      [2688, 82.4],
      [2688, 111],
      [3840, 110],
      [1920, 30],
      [4000, 55],
    ] as const) {
      const d = computeDoriDistancesM(pixelWidth, hfovDeg)
      expect(d.identify).toBeCloseTo(d.detect / 10, 6)
      // ppm ratios are fixed (25:62.5:125:250 = 1:2.5:5:10), so every pair
      // of zones keeps the same ratio regardless of pixelWidth/hfov.
      expect(d.recognize).toBeCloseTo(d.detect / 5, 6)
      expect(d.observe).toBeCloseTo(d.detect / 2.5, 6)
    }
  })
})

describe('computeDoriDistancesM - arc model (HFOV >= 180)', () => {
  it('2048px / 360deg', () => {
    const d = computeDoriDistancesM(2048, 360)
    expect(Math.abs(d.detect - 13.04)).toBeLessThan(TOLERANCE_M)
  })

  it('2048px / 180deg matches 2048 / (25 * pi) exactly', () => {
    const d = computeDoriDistancesM(2048, 180)
    expect(d.detect).toBeCloseTo(2048 / (25 * Math.PI), 6)
    expect(Math.abs(d.detect - 26.08)).toBeLessThan(TOLERANCE_M)
  })
})

describe('isApproximateDoriModel', () => {
  it('false below 180deg, true at and above 180deg', () => {
    expect(isApproximateDoriModel(179.9)).toBe(false)
    expect(isApproximateDoriModel(180)).toBe(true)
    expect(isApproximateDoriModel(360)).toBe(true)
  })

  it('179.9deg vs 180deg is a real discontinuity, not a rounding artifact', () => {
    const justBelow = computeDoriDistancesM(2048, 179.9)
    const at180 = computeDoriDistancesM(2048, 180)
    // Approaching 180deg from below, tan(HFOV/2) -> tan(90deg) -> +Infinity,
    // so the rectilinear detect distance collapses toward 0. At exactly
    // 180deg the arc model takes over and jumps back up to ~26m. The two
    // formulas do not meet at the boundary - that is the documented jump.
    expect(justBelow.detect).toBeLessThan(1)
    expect(at180.detect - justBelow.detect).toBeGreaterThan(20)
  })
})

describe('computeDoriDistancesM - invalid input', () => {
  it('throws on non-positive or non-finite pixelWidth', () => {
    expect(() => computeDoriDistancesM(0, 90)).toThrow()
    expect(() => computeDoriDistancesM(-100, 90)).toThrow()
    expect(() => computeDoriDistancesM(NaN, 90)).toThrow()
    expect(() => computeDoriDistancesM(Infinity, 90)).toThrow()
  })

  it('throws on HFOV outside (0, 360]', () => {
    expect(() => computeDoriDistancesM(1920, 0)).toThrow()
    expect(() => computeDoriDistancesM(1920, -10)).toThrow()
    expect(() => computeDoriDistancesM(1920, 361)).toThrow()
    expect(() => computeDoriDistancesM(1920, NaN)).toThrow()
  })

  it('accepts HFOV = 360 exactly (full circle)', () => {
    expect(() => computeDoriDistancesM(1920, 360)).not.toThrow()
  })
})
