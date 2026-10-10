import { describe, expect, it } from 'vitest'
import { computeCableLabelAnchor } from './cable-label-anchor'

describe('computeCableLabelAnchor', () => {
  it('null for fewer than 2 points', () => {
    expect(computeCableLabelAnchor([])).toBeNull()
    expect(computeCableLabelAnchor([{ x: 0, y: 0 }])).toBeNull()
  })

  it('null for a zero-length path (every point the same)', () => {
    expect(computeCableLabelAnchor([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }])).toBeNull()
  })

  it('horizontal left-to-right: normal points up (0,-1), angle 0', () => {
    const anchor = computeCableLabelAnchor([{ x: 0, y: 0 }, { x: 10, y: 0 }])
    expect(anchor).toEqual({ x: 4, y: 0, normalX: 0, normalY: -1, angleDeg: 0 })
  })

  it('horizontal right-to-left: same upward normal, angle normalised to 0 (not 180)', () => {
    const anchor = computeCableLabelAnchor([{ x: 10, y: 0 }, { x: 0, y: 0 }])
    expect(anchor).toEqual({ x: 6, y: 0, normalX: 0, normalY: -1, angleDeg: 0 })
  })

  it('vertical downward: tie-break normal +x (1,0), angle 90', () => {
    const anchor = computeCableLabelAnchor([{ x: 0, y: 0 }, { x: 0, y: 10 }])
    expect(anchor).toEqual({ x: 0, y: 4, normalX: 1, normalY: 0, angleDeg: 90 })
  })

  it('vertical upward: tie-break normal +x (1,0), angle normalised to 90 (not -90)', () => {
    const anchor = computeCableLabelAnchor([{ x: 0, y: 10 }, { x: 0, y: 0 }])
    expect(anchor).toEqual({ x: 0, y: 6, normalX: 1, normalY: 0, angleDeg: 90 })
  })

  it('diagonal 2-point: upward normal and a 45deg angle', () => {
    const anchor = computeCableLabelAnchor([{ x: 0, y: 0 }, { x: 10, y: 10 }])
    expect(anchor?.x).toBeCloseTo(4)
    expect(anchor?.y).toBeCloseTo(4)
    expect(anchor?.normalY).toBeLessThanOrEqual(0)
    expect(anchor?.angleDeg).toBeCloseTo(45)
  })

  it('multi-segment: 40% of the total length falls into the second segment', () => {
    // segment 1: (0,0)->(2,0), length 2; segment 2: (2,0)->(10,0), length 8; total 10, target 4.
    const anchor = computeCableLabelAnchor([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 10, y: 0 }])
    expect(anchor).toEqual({ x: 4, y: 0, normalX: 0, normalY: -1, angleDeg: 0 })
  })

  it('skips a zero-length segment (a repeated point) in the middle of the path', () => {
    const anchor = computeCableLabelAnchor([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 0 }, { x: 10, y: 0 }])
    expect(anchor).toEqual({ x: 4, y: 0, normalX: 0, normalY: -1, angleDeg: 0 })
  })

  it('a custom fraction moves the anchor further along the path', () => {
    const anchor = computeCableLabelAnchor([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0.9)
    expect(anchor?.x).toBeCloseTo(9)
  })
})
