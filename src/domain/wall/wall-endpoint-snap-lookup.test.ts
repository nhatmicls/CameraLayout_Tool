import { describe, expect, it } from 'vitest'
import { findNearestWallEndpointWithinTolerance } from './wall-endpoint-snap-lookup'
import type { WallSegment } from './wall-segment-geometry'

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ x1, y1, x2, y2 })

describe('findNearestWallEndpointWithinTolerance', () => {
  const wall = seg(10.25, 20.5, 110.75, 20.5)

  it('returns null with no walls', () => {
    expect(findNearestWallEndpointWithinTolerance(0, 0, [], 10)).toBeNull()
  })

  it('snaps to a start endpoint and to an end endpoint, with exact stored coordinates', () => {
    expect(findNearestWallEndpointWithinTolerance(12, 22, [wall], 5)).toEqual({ x: 10.25, y: 20.5 })
    expect(findNearestWallEndpointWithinTolerance(108, 19, [wall], 5)).toEqual({ x: 110.75, y: 20.5 })
  })

  it('is inclusive at exactly the tolerance and null just beyond it', () => {
    const origin = seg(0, 0, 100, 0)
    expect(findNearestWallEndpointWithinTolerance(3, 4, [origin], 5)).toEqual({ x: 0, y: 0 })
    expect(findNearestWallEndpointWithinTolerance(3, 4.01, [origin], 5)).toBeNull()
  })

  it('picks the nearer of two endpoints in range', () => {
    const walls = [seg(0, 0, 100, 0), seg(4, 0, 4, 100)]
    expect(findNearestWallEndpointWithinTolerance(3, 0, walls, 10)).toEqual({ x: 4, y: 0 })
  })

  it('picks the first in array order when two endpoints are equally near', () => {
    const walls = [seg(-5, 0, -100, 0), seg(5, 0, 100, 0)]
    expect(findNearestWallEndpointWithinTolerance(0, 0, walls, 10)).toEqual({ x: -5, y: 0 })
  })

  it('never snaps to a wall body', () => {
    expect(findNearestWallEndpointWithinTolerance(60, 21, [wall], 10)).toBeNull()
  })

  it('treats glass wall endpoints as candidates too', () => {
    const glass = { ...seg(200, 200, 300, 200), kind: 'glass' }
    expect(findNearestWallEndpointWithinTolerance(201, 201, [glass], 5)).toEqual({ x: 200, y: 200 })
  })

  it('returns null for a zero, negative or NaN tolerance', () => {
    expect(findNearestWallEndpointWithinTolerance(10.25, 20.5, [wall], 0)).toBeNull()
    expect(findNearestWallEndpointWithinTolerance(10.25, 20.5, [wall], -3)).toBeNull()
    expect(findNearestWallEndpointWithinTolerance(10.25, 20.5, [wall], Number.NaN)).toBeNull()
  })

  it('returns a corner shared by two walls as one point', () => {
    const walls = [seg(0, 0, 50, 0), seg(50, 0, 50, 50)]
    expect(findNearestWallEndpointWithinTolerance(51, 1, walls, 5)).toEqual({ x: 50, y: 0 })
  })
})
