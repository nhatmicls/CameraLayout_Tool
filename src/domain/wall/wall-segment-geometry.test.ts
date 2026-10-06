import { describe, expect, it } from 'vitest'
import {
  clipSegmentToDisc,
  distancePointToSegmentPx,
  isSameWallSegment,
  rayFromOriginHitDistance,
  segmentIntersectionPoint,
  selectBlockingWallSegments,
  selectOpaqueWallSegments,
  wallSegmentLengthPx,
  type WallSegment,
} from './wall-segment-geometry'

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ x1, y1, x2, y2 })

describe('wallSegmentLengthPx', () => {
  it('measures a 3-4-5 segment and a zero-length one', () => {
    expect(wallSegmentLengthPx(seg(0, 0, 3, 4))).toBe(5)
    expect(wallSegmentLengthPx(seg(7, 7, 7, 7))).toBe(0)
  })
})

describe('isSameWallSegment', () => {
  it('matches the same two points in either direction and nothing else', () => {
    expect(isSameWallSegment(seg(1, 2, 3, 4), seg(1, 2, 3, 4))).toBe(true)
    expect(isSameWallSegment(seg(1, 2, 3, 4), seg(3, 4, 1, 2))).toBe(true)
    expect(isSameWallSegment(seg(1, 2, 3, 4), seg(1, 2, 3, 5))).toBe(false)
    expect(isSameWallSegment(seg(1, 2, 3, 4), seg(3, 4, 1, 2.5))).toBe(false)
  })
})

describe('distancePointToSegmentPx', () => {
  const s = seg(0, 0, 10, 0)

  it('uses the perpendicular foot when it falls inside the segment', () => {
    expect(distancePointToSegmentPx(5, 3, s)).toBeCloseTo(3)
  })

  it('uses the nearer endpoint beyond either end', () => {
    expect(distancePointToSegmentPx(-3, 4, s)).toBeCloseTo(5)
    expect(distancePointToSegmentPx(13, 4, s)).toBeCloseTo(5)
  })

  it('handles a zero-length segment as a point', () => {
    expect(distancePointToSegmentPx(3, 4, seg(0, 0, 0, 0))).toBeCloseTo(5)
  })
})

describe('clipSegmentToDisc', () => {
  it('returns the same segment when fully inside', () => {
    const s = seg(-10, 5, 10, 5)
    expect(clipSegmentToDisc(s, 100)).toBe(s)
  })

  it('returns null when fully outside', () => {
    expect(clipSegmentToDisc(seg(200, -50, 200, 50), 100)).toBeNull()
    expect(clipSegmentToDisc(seg(150, 0, 300, 0), 100)).toBeNull()
  })

  it('cuts a segment with one end inside at the disc edge', () => {
    const clipped = clipSegmentToDisc(seg(0, 0, 200, 0), 100)
    expect(clipped).not.toBeNull()
    expect(clipped!.x1).toBe(0)
    expect(clipped!.x2).toBeCloseTo(100)
    expect(clipped!.y2).toBeCloseTo(0)
  })

  it('keeps only the chord of a segment passing right through', () => {
    const clipped = clipSegmentToDisc(seg(-200, 60, 200, 60), 100)
    expect(clipped).not.toBeNull()
    expect(clipped!.x1).toBeCloseTo(-80)
    expect(clipped!.x2).toBeCloseTo(80)
    expect(clipped!.y1).toBeCloseTo(60)
  })

  it('treats a tangent segment as outside', () => {
    expect(clipSegmentToDisc(seg(-200, 100, 200, 100), 100)).toBeNull()
  })

  it('handles a zero-length segment without throwing', () => {
    const inside = seg(10, 10, 10, 10)
    expect(clipSegmentToDisc(inside, 100)).toBe(inside)
    expect(clipSegmentToDisc(seg(500, 0, 500, 0), 100)).toBeNull()
  })
})

describe('segmentIntersectionPoint', () => {
  it('finds the crossing point of an X', () => {
    const point = segmentIntersectionPoint(seg(0, 0, 10, 10), seg(0, 10, 10, 0))
    expect(point!.x).toBeCloseTo(5)
    expect(point!.y).toBeCloseTo(5)
  })

  it('reports a T-touch at the touching point', () => {
    const point = segmentIntersectionPoint(seg(0, 0, 10, 0), seg(5, 0, 5, 10))
    expect(point!.x).toBeCloseTo(5)
    expect(point!.y).toBeCloseTo(0)
  })

  it('returns null for parallel, collinear-overlapping and disjoint segments', () => {
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(0, 5, 10, 5))).toBeNull()
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(5, 0, 15, 0))).toBeNull()
    expect(segmentIntersectionPoint(seg(0, 0, 10, 0), seg(20, -5, 20, 5))).toBeNull()
  })

  it('returns null when either segment has zero length', () => {
    expect(segmentIntersectionPoint(seg(5, 0, 5, 0), seg(0, 0, 10, 0))).toBeNull()
  })
})

describe('rayFromOriginHitDistance', () => {
  it('returns the distance to a segment in front', () => {
    expect(rayFromOriginHitDistance(1, 0, seg(50, -10, 50, 10))).toBeCloseTo(50)
  })

  it('returns Infinity when the ray passes beside the segment', () => {
    expect(rayFromOriginHitDistance(1, 0, seg(50, 10, 50, 30))).toBe(Infinity)
  })

  it('returns Infinity when the segment is behind the origin', () => {
    expect(rayFromOriginHitDistance(1, 0, seg(-50, -10, -50, 10))).toBe(Infinity)
  })

  it('returns Infinity for a parallel segment', () => {
    expect(rayFromOriginHitDistance(1, 0, seg(10, 5, 60, 5))).toBe(Infinity)
  })

  it('hits a segment endpoint exactly', () => {
    expect(rayFromOriginHitDistance(1, 0, seg(50, 0, 50, 40))).toBeCloseTo(50)
  })
})

describe('selectOpaqueWallSegments', () => {
  it('drops glass walls and keeps the opaque ones, by identity', () => {
    const opaque = { ...seg(0, 0, 1, 1), kind: 'opaque' }
    const glass = { ...seg(2, 2, 3, 3), kind: 'glass' }
    const selected = selectOpaqueWallSegments([opaque, glass])
    expect(selected).toHaveLength(1)
    expect(selected[0]).toBe(opaque)
  })
})

describe('selectBlockingWallSegments', () => {
  const opaque = { ...seg(0, 0, 1, 1), kind: 'opaque' }
  const glass = { ...seg(2, 2, 3, 3), kind: 'glass' }

  it('excludes glass when only opaque is a blocking kind', () => {
    const selected = selectBlockingWallSegments([opaque, glass], ['opaque'])
    expect(selected).toEqual([opaque])
  })

  it('includes both when both kinds are listed as blocking', () => {
    const selected = selectBlockingWallSegments([opaque, glass], ['opaque', 'glass'])
    expect(selected).toEqual([opaque, glass])
  })

  it('returns an empty array when no kind matches', () => {
    expect(selectBlockingWallSegments([opaque, glass], [])).toEqual([])
  })
})
