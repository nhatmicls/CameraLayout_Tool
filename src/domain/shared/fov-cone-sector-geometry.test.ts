import { describe, expect, it } from 'vitest'
import {
  bearingDegBetweenPoints,
  coneSweepShape,
  normalizeDegrees,
  pointAtBearing,
  sectorStartDeg,
} from './fov-cone-sector-geometry'

describe('normalizeDegrees', () => {
  it('leaves in-range values unchanged', () => {
    expect(normalizeDegrees(0)).toBe(0)
    expect(normalizeDegrees(45)).toBe(45)
    expect(normalizeDegrees(359.9)).toBeCloseTo(359.9, 6)
  })

  it('wraps 360 down to 0', () => {
    expect(normalizeDegrees(360)).toBe(0)
  })

  it('wraps negatives into [0, 360)', () => {
    expect(normalizeDegrees(-10)).toBe(350)
    expect(normalizeDegrees(-370)).toBe(350)
  })

  it('wraps values far above 360', () => {
    expect(normalizeDegrees(725)).toBe(5)
  })

  it('throws on non-finite input', () => {
    expect(() => normalizeDegrees(NaN)).toThrow()
    expect(() => normalizeDegrees(Infinity)).toThrow()
  })
})

describe('sectorStartDeg', () => {
  it('is rotation minus half the HFOV', () => {
    expect(sectorStartDeg(90, 60)).toBe(60)
  })

  it('wraps around 0/360', () => {
    expect(sectorStartDeg(10, 60)).toBe(340)
  })
})

describe('bearingDegBetweenPoints + pointAtBearing round-trip (y-down)', () => {
  it('east is 0deg, south is 90deg, west is 180deg, north is 270deg', () => {
    expect(bearingDegBetweenPoints(0, 0, 10, 0)).toBeCloseTo(0, 6) // +x
    expect(bearingDegBetweenPoints(0, 0, 0, 10)).toBeCloseTo(90, 6) // +y (down)
    expect(bearingDegBetweenPoints(0, 0, -10, 0)).toBeCloseTo(180, 6) // -x
    expect(bearingDegBetweenPoints(0, 0, 0, -10)).toBeCloseTo(270, 6) // -y (up)
  })

  it('covers all four quadrants', () => {
    expect(bearingDegBetweenPoints(0, 0, 10, 10)).toBeCloseTo(45, 6)
    expect(bearingDegBetweenPoints(0, 0, -10, 10)).toBeCloseTo(135, 6)
    expect(bearingDegBetweenPoints(0, 0, -10, -10)).toBeCloseTo(225, 6)
    expect(bearingDegBetweenPoints(0, 0, 10, -10)).toBeCloseTo(315, 6)
  })

  it('throws when point coincides with centre', () => {
    expect(() => bearingDegBetweenPoints(5, 5, 5, 5)).toThrow()
  })

  it('pointAtBearing round-trips with bearingDegBetweenPoints', () => {
    const cx = 100
    const cy = 200
    for (const deg of [0, 30, 90, 135, 180, 225, 270, 315]) {
      const p = pointAtBearing(cx, cy, deg, 50)
      const back = bearingDegBetweenPoints(cx, cy, p.x, p.y)
      expect(back).toBeCloseTo(deg, 4)
    }
  })

  it('pointAtBearing throws on negative distance', () => {
    expect(() => pointAtBearing(0, 0, 45, -1)).toThrow()
  })
})

describe('coneSweepShape', () => {
  it('sector below 180deg', () => {
    expect(coneSweepShape(110)).toBe('sector')
  })

  it('half-disc at exactly 180deg', () => {
    expect(coneSweepShape(180)).toBe('half-disc')
  })

  it('full-circle at 360deg and above', () => {
    expect(coneSweepShape(360)).toBe('full-circle')
  })
})
