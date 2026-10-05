import { describe, expect, it } from 'vitest'
import { computeWallOcclusionVisibilityPolygon } from './wall-occlusion-visibility-polygon'
import type { WallSegment } from './wall-segment-geometry'

const CAMERA = { x: 100, y: 100 }
const RADIUS = 100
const UNOBSTRUCTED_RADIUS = RADIUS / Math.cos((2.5 * Math.PI) / 180)

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ x1, y1, x2, y2 })

function polygonFor(segments: WallSegment[], originClearancePx = 0): number[] | null {
  return computeWallOcclusionVisibilityPolygon({
    originX: CAMERA.x,
    originY: CAMERA.y,
    radiusPx: RADIUS,
    segments,
    originClearancePx,
  })
}

function expectPolygon(segments: WallSegment[], originClearancePx = 0): number[] {
  const polygon = polygonFor(segments, originClearancePx)
  if (!polygon) throw new Error('expected a polygon, got null')
  return polygon
}

/** Even-odd test; (x, y) are image px, the polygon is camera-relative. */
function isVisible(polygon: number[], x: number, y: number): boolean {
  const px = x - CAMERA.x
  const py = y - CAMERA.y
  let inside = false
  const count = polygon.length / 2
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = polygon[2 * i]
    const yi = polygon[2 * i + 1]
    const xj = polygon[2 * j]
    const yj = polygon[2 * j + 1]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function polygonArea(polygon: number[]): number {
  let twiceArea = 0
  const count = polygon.length / 2
  for (let i = 0, j = count - 1; i < count; j = i++) {
    twiceArea += polygon[2 * j] * polygon[2 * i + 1] - polygon[2 * i] * polygon[2 * j + 1]
  }
  return Math.abs(twiceArea) / 2
}

function hasVertexNear(polygon: number[], relX: number, relY: number, tolerance: number): boolean {
  for (let i = 0; i < polygon.length; i += 2) {
    if (Math.hypot(polygon[i] - relX, polygon[i + 1] - relY) <= tolerance) return true
  }
  return false
}

const WALL_IN_FRONT = seg(150, 50, 150, 150)

describe('computeWallOcclusionVisibilityPolygon - nothing to clip', () => {
  it('returns null with no segments', () => {
    expect(polygonFor([])).toBeNull()
  })

  it('returns null when every segment is outside the range disc', () => {
    expect(polygonFor([seg(300, 0, 300, 200), seg(-50, -50, -50, 250)])).toBeNull()
  })

  it('returns null for a zero-length wall only', () => {
    expect(polygonFor([seg(150, 100, 150, 100)])).toBeNull()
  })

  it('ignores a wall the camera sits on (interior or endpoint), clearance 0', () => {
    expect(polygonFor([seg(50, 100, 150, 100)])).toBeNull()
    expect(polygonFor([seg(100, 100, 200, 100)])).toBeNull()
  })
})

describe('computeWallOcclusionVisibilityPolygon - occlusion', () => {
  it('hides what is behind a wall and keeps the front and the sides', () => {
    const polygon = expectPolygon([WALL_IN_FRONT])
    expect(isVisible(polygon, 180, 100)).toBe(false)
    expect(isVisible(polygon, 130, 100)).toBe(true)
    expect(isVisible(polygon, 100, 160)).toBe(true)
  })

  it('lets the view pass a wall end and puts a vertex where the wall leaves the range', () => {
    const polygon = expectPolygon([seg(150, 120, 150, 300)])
    expect(isVisible(polygon, 170, 110)).toBe(true)
    expect(isVisible(polygon, 175, 150)).toBe(false)
    expect(hasVertexNear(polygon, 50, Math.sqrt(RADIUS ** 2 - 50 ** 2), 1e-6)).toBe(true)
  })

  it('handles crossing walls: far wedge hidden, near wedge visible, a vertex at the crossing', () => {
    const polygon = expectPolygon([seg(130, 60, 190, 140), seg(130, 140, 190, 60)])
    expect(isVisible(polygon, 185, 100)).toBe(false)
    expect(isVisible(polygon, 140, 100)).toBe(true)
    expect(hasVertexNear(polygon, 60, 0, 1e-3)).toBe(true)
  })

  it('treats collinear overlapping and duplicate walls like the single merged wall', () => {
    const merged = expectPolygon([WALL_IN_FRONT])
    const pieces = expectPolygon([seg(150, 50, 150, 110), seg(150, 90, 150, 150), seg(150, 50, 150, 110)])
    const probes = [
      [180, 100],
      [130, 100],
      [170, 70],
      [170, 140],
      [100, 160],
      [160, 30],
    ]
    for (const [x, y] of probes) {
      expect(isVisible(pieces, x, y)).toBe(isVisible(merged, x, y))
    }
  })

  it('ignores a zero-length wall mixed with a real one', () => {
    expect(expectPolygon([WALL_IN_FRONT, seg(120, 100, 120, 100)])).toEqual(expectPolygon([WALL_IN_FRONT]))
  })

  it('applies the mounting-wall clearance to whole segments', () => {
    const wallAt3Px = seg(103, 50, 103, 150)
    expect(polygonFor([wallAt3Px], 5)).toBeNull()
    const blocking = expectPolygon([wallAt3Px], 2)
    expect(isVisible(blocking, 150, 100)).toBe(false)
  })

  it('is correct across the +-180 degree seam, with bearings in order', () => {
    const polygon = expectPolygon([seg(40, 50, 40, 150)])
    expect(isVisible(polygon, 10, 100)).toBe(false)
    expect(isVisible(polygon, 60, 100)).toBe(true)

    let previous = -Infinity
    for (let i = 0; i < polygon.length; i += 2) {
      let bearing = Math.atan2(polygon[i + 1], polygon[i])
      if (i === 0 && bearing > 0) bearing -= 2 * Math.PI // the first ray points along -x: atan2 may say +pi
      expect(bearing).toBeGreaterThanOrEqual(previous - 1e-9)
      previous = bearing
    }
  })

  it('fills a closed room around the camera to within 1% of its area', () => {
    const room = [seg(60, 60, 140, 60), seg(140, 60, 140, 140), seg(140, 140, 60, 140), seg(60, 140, 60, 60)]
    const polygon = expectPolygon(room)
    const roomArea = 80 * 80
    expect(Math.abs(polygonArea(polygon) - roomArea) / roomArea).toBeLessThan(0.01)
    expect(isVisible(polygon, 150, 100)).toBe(false)
  })

  it('hides the inside of a closed box the camera is outside of', () => {
    const box = [seg(150, 80, 180, 80), seg(180, 80, 180, 120), seg(180, 120, 150, 120), seg(150, 120, 150, 80)]
    const polygon = expectPolygon(box)
    expect(isVisible(polygon, 165, 100)).toBe(false)
    expect(isVisible(polygon, 130, 100)).toBe(true)
  })
})

describe('computeWallOcclusionVisibilityPolygon - output shape', () => {
  it('never cuts the range circle on the unobstructed side and never exceeds the padded radius', () => {
    const polygon = expectPolygon([WALL_IN_FRONT])
    for (let i = 0; i < polygon.length; i += 2) {
      const radius = Math.hypot(polygon[i], polygon[i + 1])
      expect(radius).toBeLessThanOrEqual(UNOBSTRUCTED_RADIUS + 1e-6)
      if (polygon[i] < 0) expect(radius).toBeGreaterThanOrEqual(RADIUS) // the wall is entirely at x > 0
    }
  })

  it('returns an even number of finite values', () => {
    const polygon = expectPolygon([WALL_IN_FRONT, seg(130, 60, 190, 140), seg(40, 50, 40, 150)])
    expect(polygon.length % 2).toBe(0)
    expect(polygon.every((value) => Number.isFinite(value))).toBe(true)
  })

  it('stays fast with 200 in-range segments (smoke bound, not a benchmark)', () => {
    // Deterministic pseudo-random walls (LCG) so the test never flakes on its input.
    let state = 12345
    const next = () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
    const segments: WallSegment[] = []
    for (let i = 0; i < 200; i++) {
      const x = 20 + next() * 160
      const y = 20 + next() * 160
      segments.push(seg(x, y, x + (next() - 0.5) * 30, y + (next() - 0.5) * 30))
    }
    // Measured: ~9 ms per run here once warm, ~2 ms in plain Node (the test runner's module
    // wrappers defeat inlining of the ray hit test). The bound only catches an accidental
    // blow-up in complexity; it leaves room for a loaded CI machine.
    for (let i = 0; i < 5; i++) polygonFor(segments, 1) // warm-up, not timed
    const runs = 50
    const start = performance.now()
    for (let i = 0; i < runs; i++) polygonFor(segments, 1)
    expect((performance.now() - start) / runs).toBeLessThan(50)
  })
})
