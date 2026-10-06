import { describe, expect, it } from 'vitest'
import { resolveWallDrawingPoint, type WallDrawingPointContext } from './wall-drawing-point-resolver'

const WALL = { x1: 100, y1: 100, x2: 300, y2: 100 }

function context(overrides: Partial<WallDrawingPointContext> = {}): WallDrawingPointContext {
  return { imageWidthPx: 1000, imageHeightPx: 800, walls: [WALL], anchor: null, snapTolerancePx: 10, ...overrides }
}

describe('resolveWallDrawingPoint', () => {
  it('returns a free point unchanged and unsnapped', () => {
    expect(resolveWallDrawingPoint({ x: 500, y: 400 }, context())).toEqual({ x: 500, y: 400, snapped: false })
  })

  it('clamps to the image rectangle', () => {
    expect(resolveWallDrawingPoint({ x: -40, y: 900 }, context())).toEqual({ x: 0, y: 800, snapped: false })
    expect(resolveWallDrawingPoint({ x: 1200, y: -5 }, context())).toEqual({ x: 1000, y: 0, snapped: false })
  })

  it('snaps onto a wall endpoint within tolerance, with its exact coordinates', () => {
    expect(resolveWallDrawingPoint({ x: 304, y: 97 }, context())).toEqual({ x: 300, y: 100, snapped: true })
  })

  it('does not snap to a wall body', () => {
    expect(resolveWallDrawingPoint({ x: 200, y: 101 }, context())).toEqual({ x: 200, y: 101, snapped: false })
  })

  it('snaps onto the anchor when no stored endpoint is near (first point placed, no segment yet)', () => {
    const anchor = { x: 600, y: 600 }
    expect(resolveWallDrawingPoint({ x: 605, y: 603 }, context({ anchor }))).toEqual({ x: 600, y: 600, snapped: true })
    expect(resolveWallDrawingPoint({ x: 620, y: 600 }, context({ anchor }))).toEqual({ x: 620, y: 600, snapped: false })
  })

  it('uses the tolerance it is given: a tighter one (zoomed in) no longer snaps', () => {
    expect(resolveWallDrawingPoint({ x: 304, y: 97 }, context({ snapTolerancePx: 2 })).snapped).toBe(false)
  })

  it('snaps after clamping, so an endpoint on the image edge is reachable from outside it', () => {
    const edgeWall = { x1: 0, y1: 50, x2: 0, y2: 300 }
    expect(resolveWallDrawingPoint({ x: -30, y: 52 }, context({ walls: [edgeWall] }))).toEqual({ x: 0, y: 50, snapped: true })
  })
})
