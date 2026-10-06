import { describe, expect, it } from 'vitest'
import { checkBeamLine } from './beam-sensor-line-check'
import type { WallSegment } from './wall-segment-geometry'

const BASE = { x1: 0, y1: 0, x2: 100, y2: 0, opaqueWalls: [] as WallSegment[], glassWalls: [] as WallSegment[], clearancePx: 5, maxDistancePx: 100 }

describe('checkBeamLine', () => {
  it('reports a clear line with no obstacles', () => {
    const result = checkBeamLine(BASE)
    expect(result).toEqual({ lengthPx: 100, overMaxDistance: false, blockedAt: null, crossesGlass: false })
  })

  it('reports exactly-at-max as not over (strictly greater only)', () => {
    expect(checkBeamLine({ ...BASE, maxDistancePx: 100 }).overMaxDistance).toBe(false)
    expect(checkBeamLine({ ...BASE, maxDistancePx: 99.999 }).overMaxDistance).toBe(true)
  })

  // A beam set to exactly the datasheet limit can come out a float hair over (metres<->px
  // round-tripping) - the relative tolerance absorbs that without masking a real,
  // meaningfully-over beam (the 99.999 case above still trips it).
  it('does not flag a beam only a float hair over the limit (float tolerance)', () => {
    expect(checkBeamLine({ ...BASE, maxDistancePx: 99.99999999999999 }).overMaxDistance).toBe(false)
  })

  it('reports the crossing point of a single opaque wall', () => {
    const wall: WallSegment = { x1: 50, y1: -10, x2: 50, y2: 10 }
    const result = checkBeamLine({ ...BASE, opaqueWalls: [wall] })
    expect(result.blockedAt).toEqual({ x: 50, y: 0 })
  })

  it('keeps the crossing nearest the transmitter when two opaque walls cross', () => {
    const near: WallSegment = { x1: 30, y1: -10, x2: 30, y2: 10 }
    const far: WallSegment = { x1: 70, y1: -10, x2: 70, y2: 10 }
    const result = checkBeamLine({ ...BASE, opaqueWalls: [far, near] })
    expect(result.blockedAt).toEqual({ x: 30, y: 0 })
  })

  it('sets crossesGlass without blocking when only a glass wall crosses', () => {
    const glass: WallSegment = { x1: 50, y1: -10, x2: 50, y2: 10 }
    const result = checkBeamLine({ ...BASE, glassWalls: [glass] })
    expect(result.blockedAt).toBeNull()
    expect(result.crossesGlass).toBe(true)
  })

  it('ignores a wall within clearancePx of the transmitter end', () => {
    const mountingWall: WallSegment = { x1: 0, y1: -3, x2: 0, y2: 3 } // crosses beam at (0,0), the transmitter itself
    const result = checkBeamLine({ ...BASE, opaqueWalls: [mountingWall] })
    expect(result.blockedAt).toBeNull()
  })

  it('ignores a wall within clearancePx of the receiver end', () => {
    const mountingWall: WallSegment = { x1: 100, y1: -3, x2: 100, y2: 3 }
    const result = checkBeamLine({ ...BASE, opaqueWalls: [mountingWall] })
    expect(result.blockedAt).toBeNull()
  })

  it('does not treat a wall running exactly along the beam as blocking (collinear overlap documented, not fixed)', () => {
    const collinear: WallSegment = { x1: 0, y1: 0, x2: 100, y2: 0 }
    const result = checkBeamLine({ ...BASE, opaqueWalls: [collinear] })
    expect(result.blockedAt).toBeNull()
  })
})
