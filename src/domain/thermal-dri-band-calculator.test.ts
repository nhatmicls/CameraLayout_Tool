import { describe, expect, it } from 'vitest'
import { computeThermalDriBands } from './thermal-dri-band-calculator'

const DRI = { identify: 50, recognize: 150, detect: 300 }

describe('computeThermalDriBands', () => {
  it('returns all three bands nearest-to-farthest when rangeM covers the full detect distance', () => {
    expect(computeThermalDriBands(DRI, 300)).toEqual([
      { zone: 'identify', innerM: 0, outerM: 50 },
      { zone: 'recognize', innerM: 50, outerM: 150 },
      { zone: 'detect', innerM: 150, outerM: 300 },
    ])
  })

  it('clips the farthest band to rangeM when rangeM falls inside it', () => {
    expect(computeThermalDriBands(DRI, 200)).toEqual([
      { zone: 'identify', innerM: 0, outerM: 50 },
      { zone: 'recognize', innerM: 50, outerM: 150 },
      { zone: 'detect', innerM: 150, outerM: 200 },
    ])
  })

  it('drops a band that would be zero-width after clipping', () => {
    // rangeM = 150 lands exactly on the recognize/detect boundary: detect's clipped outer (150) equals its inner (150).
    expect(computeThermalDriBands(DRI, 150)).toEqual([
      { zone: 'identify', innerM: 0, outerM: 50 },
      { zone: 'recognize', innerM: 50, outerM: 150 },
    ])
  })

  it('drops recognize and detect entirely when rangeM is inside the identify band', () => {
    expect(computeThermalDriBands(DRI, 30)).toEqual([{ zone: 'identify', innerM: 0, outerM: 30 }])
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('throws for a non-positive/non-finite rangeM %s', (rangeM) => {
    expect(() => computeThermalDriBands(DRI, rangeM)).toThrow(/rangeM/)
  })
})
