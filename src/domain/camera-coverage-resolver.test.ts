import { describe, expect, it } from 'vitest'
import {
  computeDoriBands,
  DEFAULT_MAX_RANGE_M,
  resolveDefaultRangeM,
  resolveEffectiveHfovDeg,
} from './camera-coverage-resolver'
import { computeDoriDistancesM } from './dori-zone-distance-calculator'
import type { CameraModelSpec } from './project-types'

describe('resolveEffectiveHfovDeg', () => {
  it('fixed lens always returns its datasheet HFOV, ignoring any override', () => {
    const lens = { kind: 'fixed' as const, focalMm: 2.8, hfovDeg: 111 }
    expect(resolveEffectiveHfovDeg(lens, 90)).toBe(111)
    expect(resolveEffectiveHfovDeg(lens)).toBe(111)
  })

  it('varifocal defaults to wide when no override given', () => {
    const lens = { kind: 'varifocal' as const, focalMinMm: 2.8, focalMaxMm: 12, hfovWideDeg: 100, hfovTeleDeg: 30 }
    expect(resolveEffectiveHfovDeg(lens)).toBe(100)
    expect(resolveEffectiveHfovDeg(lens, undefined)).toBe(100)
  })

  it('varifocal clamps an override into [tele, wide]', () => {
    const lens = { kind: 'varifocal' as const, focalMinMm: 2.8, focalMaxMm: 12, hfovWideDeg: 100, hfovTeleDeg: 30 }
    expect(resolveEffectiveHfovDeg(lens, 60)).toBe(60)
    expect(resolveEffectiveHfovDeg(lens, 200)).toBe(100)
    expect(resolveEffectiveHfovDeg(lens, 5)).toBe(30)
  })

  it('varifocal falls back to wide on a non-finite override', () => {
    const lens = { kind: 'varifocal' as const, focalMinMm: 2.8, focalMaxMm: 12, hfovWideDeg: 100, hfovTeleDeg: 30 }
    expect(resolveEffectiveHfovDeg(lens, NaN)).toBe(100)
  })
})

describe('resolveDefaultRangeM', () => {
  const baseModel: CameraModelSpec = {
    brand: 'hikvision',
    model: 'DS-2CD2143G2-I',
    formFactor: 'dome',
    pixelWidth: 2688,
    pixelHeight: 1520,
    resolutionMp: 4,
    lens: { kind: 'fixed', focalMm: 2.8, hfovDeg: 111 },
    illuminationRangeM: null,
  }

  it('uses the published illumination range when present', () => {
    const model = { ...baseModel, illuminationRangeM: 40 }
    expect(resolveDefaultRangeM(model, 111)).toBe(40)
  })

  it('falls back to min(detectM, DEFAULT_MAX_RANGE_M) when illuminationRangeM is null', () => {
    // detectM for 2688px/111deg = 36.95, well above the 15m cap.
    expect(resolveDefaultRangeM(baseModel, 111)).toBeCloseTo(DEFAULT_MAX_RANGE_M, 2)
  })

  it('uses the detect distance itself when it is smaller than the cap', () => {
    // A narrow HFOV pushes detect distance far past 15m is the common case;
    // pick a wide HFOV/low pixel width so detect < 15m instead.
    const model = { ...baseModel, pixelWidth: 100, illuminationRangeM: null }
    const detectM = computeDoriDistancesM(100, 111).detect
    expect(detectM).toBeLessThan(DEFAULT_MAX_RANGE_M)
    expect(resolveDefaultRangeM(model, 111)).toBeCloseTo(detectM, 6)
  })
})

describe('computeDoriBands', () => {
  const distances = computeDoriDistancesM(2688, 111) // detect 36.95, identify 3.70

  it('clips the detect band to an explicit rangeM below detectM, with no beyond-detect band', () => {
    const bands = computeDoriBands(distances, 30)
    const detectBand = bands.find((b) => b.zone === 'detect')
    expect(detectBand?.outerM).toBeCloseTo(30, 6)
    expect(bands.some((b) => b.zone === 'beyond-detect')).toBe(false)
    // Bands are contiguous and ordered identify -> detect.
    expect(bands.map((b) => b.zone)).toEqual(['identify', 'recognize', 'observe', 'detect'])
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].innerM).toBeCloseTo(bands[i - 1].outerM, 6)
    }
  })

  it('adds a beyond-detect band when rangeM exceeds detectM', () => {
    const bands = computeDoriBands(distances, 50)
    const beyond = bands.find((b) => b.zone === 'beyond-detect')
    expect(beyond).toBeDefined()
    expect(beyond?.innerM).toBeCloseTo(distances.detect, 6)
    expect(beyond?.outerM).toBeCloseTo(50, 6)
  })

  it('drops zero-width bands when rangeM is smaller than a zone threshold', () => {
    const bands = computeDoriBands(distances, 1) // smaller than identify (3.70)
    expect(bands).toHaveLength(1)
    expect(bands[0]).toEqual({ zone: 'identify', innerM: 0, outerM: 1 })
  })

  it('throws on non-positive or non-finite rangeM', () => {
    expect(() => computeDoriBands(distances, 0)).toThrow()
    expect(() => computeDoriBands(distances, -5)).toThrow()
    expect(() => computeDoriBands(distances, NaN)).toThrow()
  })
})
