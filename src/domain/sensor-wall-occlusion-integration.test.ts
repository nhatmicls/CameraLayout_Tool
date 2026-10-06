import { describe, expect, it } from 'vitest'
import { SENSOR_BLOCKING_WALL_KINDS } from './sensor-wall-blocking-rules'
import { computeWallOcclusionVisibilityPolygon } from './wall-occlusion-visibility-polygon'
import { selectBlockingWallSegments } from './wall-segment-geometry'

/**
 * Integration test for the plan's core occlusion claim: "glass blocks PIR
 * and thermal, but not vibration." Exercises the real `selectBlockingWallSegments`
 * + `computeWallOcclusionVisibilityPolygon` together (no mocks) - the one
 * polygon implementation, fed two different kind lists.
 */
describe('sensor kind vs wall kind - glass occlusion (integration)', () => {
  const radiusPx = 100
  const glassWall = { id: 'g1', kind: 'glass' as const, x1: 50, y1: -50, x2: 50, y2: 50 }

  function polygonFor(blockingKinds: readonly string[]) {
    const segments = selectBlockingWallSegments([glassWall], blockingKinds)
    return computeWallOcclusionVisibilityPolygon({
      originX: 0,
      originY: 0,
      radiusPx,
      segments,
      originClearancePx: 0,
    })
  }

  it('a glass wall does not occlude a vibration sensor (opaque-only blocking)', () => {
    expect(polygonFor(SENSOR_BLOCKING_WALL_KINDS.vibration)).toBeNull()
  })

  it('the same glass wall does occlude a pir sensor (opaque + glass blocking)', () => {
    expect(polygonFor(SENSOR_BLOCKING_WALL_KINDS.pir)).not.toBeNull()
  })

  it('the same glass wall does occlude a thermal sensor (opaque + glass blocking)', () => {
    expect(polygonFor(SENSOR_BLOCKING_WALL_KINDS.thermal)).not.toBeNull()
  })

  it('a glass wall does not occlude a beam sensor (opaque-only blocking)', () => {
    expect(polygonFor(SENSOR_BLOCKING_WALL_KINDS.beam)).toBeNull()
  })
})
