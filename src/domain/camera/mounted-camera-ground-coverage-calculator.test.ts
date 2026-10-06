import { describe, expect, it } from 'vitest'
import { computeDoriDistancesM } from './dori-zone-distance-calculator'
import {
  computeGroundCoverageEdgesM,
  computeMountedGroundCoverage,
  slantToGroundDistanceM,
  suggestTiltDegForFarEdgeM,
  type MountedGroundCoverageInput,
} from './mounted-camera-ground-coverage-calculator'

describe('computeGroundCoverageEdgesM', () => {
  it('computes near and far along the centre line', () => {
    const edges = computeGroundCoverageEdgesM(3, 30, 40)
    expect(edges.nearM).toBeCloseTo(2.517, 2) // 3 / tan(50deg)
    expect(edges.farM).toBeCloseTo(17.014, 2) // 3 / tan(10deg)
  })

  it('horizontal camera: far edge is unbounded', () => {
    const edges = computeGroundCoverageEdgesM(3, 0, 40)
    expect(edges.nearM).toBeCloseTo(8.242, 2)
    expect(edges.farM).toBe(Infinity)
  })

  it('camera pointing straight down: no blind spot', () => {
    const edges = computeGroundCoverageEdgesM(3, 90, 40)
    expect(edges.nearM).toBe(0)
    expect(edges.farM).toBeCloseTo(1.092, 2) // 3 * tan(20deg)
  })

  it('branches exactly at the 90deg lower edge and the 0deg upper edge', () => {
    expect(computeGroundCoverageEdgesM(3, 70, 40).nearM).toBe(0)
    expect(computeGroundCoverageEdgesM(3, 20, 40).farM).toBe(Infinity)
  })

  it('throws on out-of-range inputs', () => {
    expect(() => computeGroundCoverageEdgesM(0, 30, 40)).toThrow(/mountHeightM/)
    expect(() => computeGroundCoverageEdgesM(NaN, 30, 40)).toThrow(/mountHeightM/)
    expect(() => computeGroundCoverageEdgesM(3, -1, 40)).toThrow(/tiltDeg/)
    expect(() => computeGroundCoverageEdgesM(3, 91, 40)).toThrow(/tiltDeg/)
    expect(() => computeGroundCoverageEdgesM(3, 30, 0)).toThrow(/vfovDeg/)
    expect(() => computeGroundCoverageEdgesM(3, 30, 180)).toThrow(/vfovDeg/)
  })
})

describe('slantToGroundDistanceM', () => {
  it('projects a slant distance onto the floor', () => {
    expect(slantToGroundDistanceM(10, 3)).toBeCloseTo(9.539, 2)
  })

  it('returns null when the slant distance does not reach the floor', () => {
    expect(slantToGroundDistanceM(3, 3)).toBeNull()
    expect(slantToGroundDistanceM(2, 3)).toBeNull()
  })

  it('throws on a non-positive slant distance', () => {
    expect(() => slantToGroundDistanceM(0, 3)).toThrow(/slantM/)
  })
})

describe('suggestTiltDegForFarEdgeM', () => {
  it('puts the far edge at the target distance', () => {
    const tiltDeg = suggestTiltDegForFarEdgeM(2.7, 30, 54)
    expect(tiltDeg).toBeCloseTo(32.14, 2)
    expect(computeGroundCoverageEdgesM(2.7, tiltDeg, 54).farM).toBeCloseTo(30, 6)
  })

  it('clamps the result to 90deg', () => {
    expect(suggestTiltDegForFarEdgeM(30, 0.5, 170)).toBe(90)
  })

  it('throws on a non-positive target', () => {
    expect(() => suggestTiltDegForFarEdgeM(2.7, 0, 54)).toThrow(/targetFarM/)
  })
})

describe('computeMountedGroundCoverage', () => {
  // Slant distances: identify 3.70, recognize 7.39, observe 14.78, detect 36.95.
  const doriSlantM = computeDoriDistancesM(2688, 111)
  const base: MountedGroundCoverageInput = {
    mountHeightM: 3,
    tiltDeg: 30,
    vfovDeg: 40,
    hfovDeg: 111,
    rangeM: 50,
    doriSlantM,
  }

  it('clips bands to [nearM, effectiveFarM] with finite radii', () => {
    const coverage = computeMountedGroundCoverage(base)
    expect(coverage.fisheye).toBe(false)
    expect(coverage.nearM).toBeCloseTo(2.517, 2)
    expect(coverage.geometricFarM).toBeCloseTo(17.014, 2)
    expect(coverage.effectiveFarM).toBeCloseTo(17.014, 2)
    expect(coverage.bands[0].innerM).toBe(coverage.nearM)
    expect(coverage.bands[coverage.bands.length - 1].outerM).toBe(coverage.effectiveFarM)
    for (const band of coverage.bands) {
      expect(Number.isFinite(band.innerM)).toBe(true)
      expect(Number.isFinite(band.outerM)).toBe(true)
      expect(band.outerM).toBeGreaterThan(band.innerM)
    }
  })

  it('drops a zone that ends inside the blind spot; the next band starts at nearM', () => {
    const coverage = computeMountedGroundCoverage(base)
    // identify lands at sqrt(3.70^2 - 3^2) = 2.16 m, inside the 2.52 m blind spot.
    expect(coverage.doriGroundM.identify).toBeCloseTo(2.157, 2)
    expect(coverage.bands.map((b) => b.zone)).toEqual(['recognize', 'observe', 'detect'])
    expect(coverage.bands[0].innerM).toBe(coverage.nearM)
  })

  it('limits the far edge to rangeM when the horizon is in view', () => {
    const coverage = computeMountedGroundCoverage({ ...base, tiltDeg: 0 })
    expect(coverage.geometricFarM).toBe(Infinity)
    expect(coverage.effectiveFarM).toBe(50)
    expect(coverage.bands[coverage.bands.length - 1]).toMatchObject({ zone: 'beyond-detect', outerM: 50 })
  })

  it('returns no bands when the range ends inside the blind spot', () => {
    expect(computeMountedGroundCoverage({ ...base, rangeM: 2 }).bands).toEqual([])
  })

  it('starts the beyond-detect band at nearM when no DORI zone reaches the floor', () => {
    const coverage = computeMountedGroundCoverage({
      ...base,
      rangeM: 10,
      doriSlantM: computeDoriDistancesM(100, 111), // detect 1.37 m < 3 m height
    })
    expect(coverage.doriGroundM).toEqual({ detect: null, observe: null, recognize: null, identify: null })
    expect(coverage.bands).toEqual([{ zone: 'beyond-detect', innerM: coverage.nearM, outerM: 10 }])
  })

  it('fisheye: no blind spot, far edge is rangeM, tilt and vfov are ignored', () => {
    const fisheye = { ...base, hfovDeg: 185, vfovDeg: null, rangeM: 12, doriSlantM: computeDoriDistancesM(2688, 185) }
    const flat = computeMountedGroundCoverage({ ...fisheye, tiltDeg: 0 })
    expect(flat.fisheye).toBe(true)
    expect(flat.nearM).toBe(0)
    expect(flat.geometricFarM).toBe(Infinity)
    expect(flat.effectiveFarM).toBe(12)
    expect(flat.bands[0].innerM).toBe(0)
    expect(computeMountedGroundCoverage({ ...fisheye, tiltDeg: 45 })).toEqual(flat)
  })

  it('throws on invalid height, tilt or a missing vfov for a rectilinear lens', () => {
    expect(() => computeMountedGroundCoverage({ ...base, mountHeightM: 0 })).toThrow(/mountHeightM/)
    expect(() => computeMountedGroundCoverage({ ...base, mountHeightM: NaN })).toThrow(/mountHeightM/)
    expect(() => computeMountedGroundCoverage({ ...base, tiltDeg: 91 })).toThrow(/tiltDeg/)
    expect(() => computeMountedGroundCoverage({ ...base, hfovDeg: 100, vfovDeg: null })).toThrow(/vfovDeg/)
  })
})
