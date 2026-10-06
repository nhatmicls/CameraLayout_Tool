import { describe, expect, it } from 'vitest'
import {
  countWallsProperlyCrossedBySegment,
  hasAnyProperWallCrossing,
  wallSegmentsProperlyCross,
} from './wall-crossing-detection'
import type { WallSegment } from './wall-segment-geometry'

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ x1, y1, x2, y2 })

const CLOSED_ROOM = [seg(0, 0, 100, 0), seg(100, 0, 100, 100), seg(100, 100, 0, 100), seg(0, 100, 0, 0)]

describe('wallSegmentsProperlyCross', () => {
  it('is true for an X crossing', () => {
    expect(wallSegmentsProperlyCross(seg(0, 0, 10, 10), seg(0, 10, 10, 0))).toBe(true)
  })

  it('is false for disjoint and for parallel walls', () => {
    expect(wallSegmentsProperlyCross(seg(0, 0, 10, 0), seg(20, -5, 20, 5))).toBe(false)
    expect(wallSegmentsProperlyCross(seg(0, 0, 10, 0), seg(0, 5, 10, 5))).toBe(false)
  })

  it('is false for an L corner sharing exact coordinates', () => {
    expect(wallSegmentsProperlyCross(seg(0, 0, 50, 0), seg(50, 0, 50, 50))).toBe(false)
  })

  it('is false for a T-junction where one wall ends on the other body', () => {
    expect(wallSegmentsProperlyCross(seg(0, 0, 100, 0), seg(50, 0, 50, 60))).toBe(false)
    expect(wallSegmentsProperlyCross(seg(50, 60, 50, 0), seg(0, 0, 100, 0))).toBe(false)
  })

  it('is true when the T overshoots the body by 1 px', () => {
    expect(wallSegmentsProperlyCross(seg(0, 0, 100, 0), seg(50, -1, 50, 60))).toBe(true)
  })

  it('is false for collinear overlapping and for identical walls', () => {
    expect(wallSegmentsProperlyCross(seg(0, 0, 100, 0), seg(50, 0, 150, 0))).toBe(false)
    expect(wallSegmentsProperlyCross(seg(0, 0, 100, 0), seg(0, 0, 100, 0))).toBe(false)
  })

  it('is false for a zero-length segment against anything', () => {
    expect(wallSegmentsProperlyCross(seg(50, 0, 50, 0), seg(0, 0, 100, 0))).toBe(false)
    expect(wallSegmentsProperlyCross(seg(0, 0, 100, 0), seg(50, 0, 50, 0))).toBe(false)
  })

  it('ignores wall kind (opaque crossing glass counts)', () => {
    const opaque = { ...seg(0, 0, 10, 10), kind: 'opaque' }
    const glass = { ...seg(0, 10, 10, 0), kind: 'glass' }
    expect(wallSegmentsProperlyCross(opaque, glass)).toBe(true)
  })
})

describe('countWallsProperlyCrossedBySegment', () => {
  const verticals = [seg(10, -50, 10, 50), seg(20, -50, 20, 50), seg(30, -50, 30, 50)]

  it('counts 0, 1 and 3 crossed walls', () => {
    expect(countWallsProperlyCrossedBySegment(seg(0, 0, 5, 0), verticals)).toBe(0)
    expect(countWallsProperlyCrossedBySegment(seg(0, 0, 15, 0), verticals)).toBe(1)
    expect(countWallsProperlyCrossedBySegment(seg(0, 0, 40, 0), verticals)).toBe(3)
  })

  it("does not count a chain's previous segment (shared endpoint)", () => {
    const previous = seg(0, 0, 50, 0)
    expect(countWallsProperlyCrossedBySegment(seg(50, 0, 50, 80), [previous])).toBe(0)
  })
})

describe('hasAnyProperWallCrossing', () => {
  it('is false for no walls, one wall and a clean closed room', () => {
    expect(hasAnyProperWallCrossing([])).toBe(false)
    expect(hasAnyProperWallCrossing([seg(0, 0, 10, 0)])).toBe(false)
    expect(hasAnyProperWallCrossing(CLOSED_ROOM)).toBe(false)
  })

  it('is true for a room with one diagonal running through it', () => {
    expect(hasAnyProperWallCrossing([...CLOSED_ROOM, seg(-20, 50, 120, 50)])).toBe(true)
  })
})
