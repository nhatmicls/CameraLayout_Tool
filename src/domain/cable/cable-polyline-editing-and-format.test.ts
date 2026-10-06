import { describe, expect, it } from 'vitest'
import { MAX_CABLE_POINTS, type CablePoint } from './cable-layout-types'
import { ceilMeters, formatCableEstimateNote, formatMeters, formatMetersInterval } from './cable-length-format'
import { insertCablePointOnNearestSegment, moveCablePoint, removeCablePoint } from './cable-polyline-editing'

const points: CablePoint[] = [
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]
// device (0,0) -> (100,0) -> (100,100) -> hub (200,100)
const fullPath: CablePoint[] = [{ x: 0, y: 0 }, ...points, { x: 200, y: 100 }]

describe('moveCablePoint / removeCablePoint', () => {
  it('moves and removes the vertex at an index', () => {
    expect(moveCablePoint(points, 1, { x: 5, y: 6 })).toEqual([{ x: 100, y: 0 }, { x: 5, y: 6 }])
    expect(removeCablePoint(points, 0)).toEqual([{ x: 100, y: 100 }])
  })

  it('returns the same array for an index out of bounds', () => {
    expect(moveCablePoint(points, 2, { x: 0, y: 0 })).toBe(points)
    expect(moveCablePoint(points, -1, { x: 0, y: 0 })).toBe(points)
    expect(removeCablePoint(points, 2)).toBe(points)
  })
})

describe('insertCablePointOnNearestSegment', () => {
  it('inserts into the first segment', () => {
    expect(insertCablePointOnNearestSegment(fullPath, { x: 50, y: 2 })).toEqual([{ x: 50, y: 2 }, ...points])
  })

  it('inserts into a middle segment', () => {
    expect(insertCablePointOnNearestSegment(fullPath, { x: 98, y: 50 })).toEqual([points[0], { x: 98, y: 50 }, points[1]])
  })

  it('inserts into the last segment', () => {
    expect(insertCablePointOnNearestSegment(fullPath, { x: 150, y: 101 })).toEqual([...points, { x: 150, y: 101 }])
  })

  it('gives a 0-vertex cable its first vertex', () => {
    expect(insertCablePointOnNearestSegment([{ x: 0, y: 0 }, { x: 10, y: 0 }], { x: 5, y: 1 })).toEqual([{ x: 5, y: 1 }])
  })

  it('leaves a full cable unchanged', () => {
    const full = Array.from({ length: MAX_CABLE_POINTS }, (_, i) => ({ x: i, y: 0 }))
    expect(insertCablePointOnNearestSegment([{ x: -1, y: 0 }, ...full, { x: 999, y: 0 }], { x: 5, y: 5 })).toEqual(full)
  })
})

describe('cable length formatting', () => {
  it('formats metres to one decimal', () => {
    expect(formatMeters(17.825)).toBe('17.8 m')
    expect(formatMeters(0)).toBe('0.0 m')
  })

  it('formats an interval with and without a range', () => {
    expect(formatMetersInterval({ nominal: 17.825, min: 17.655, max: 18.0001 })).toBe('17.8 m (17.7-18.0 m)')
    expect(formatMetersInterval({ nominal: 17.825, min: null, max: null })).toBe('17.8 m')
  })

  it('rounds up without being fooled by float dust', () => {
    expect(ceilMeters(18.000000000001)).toBe(18)
    expect(ceilMeters(18.01)).toBe(19)
    expect(ceilMeters(0)).toBe(0)
  })

  it('builds the PNG note in whole metres', () => {
    expect(formatCableEstimateNote({ nominal: 43.2, min: 43.01, max: 44.4 }, 15)).toBe(
      'Cable lengths are provisional estimates: 44 m (43-45 m) incl. 15% waste',
    )
    expect(formatCableEstimateNote({ nominal: 43.2, min: null, max: null }, 0)).toBe(
      'Cable lengths are provisional estimates: 44 m incl. 0% waste',
    )
  })
})
