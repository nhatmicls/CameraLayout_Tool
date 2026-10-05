import { segmentIntersectionPoint, type WallSegment } from './wall-segment-geometry'

/**
 * Walls are expected to meet at endpoints. A "proper crossing" is two walls
 * intersecting at a point that is not an endpoint of either one; the UI warns
 * about those (occlusion is still computed correctly). Shared corners and a
 * T-junction where one wall ENDS on another's body are fine. Collinear
 * overlap has no single crossing point and is not reported. Wall kind is
 * irrelevant here.
 */

/** An intersection within this distance of any of the 4 endpoints is a touch, not a crossing. */
export const WALL_CROSSING_ENDPOINT_TOLERANCE_PX = 0.01

function isNear(point: { x: number; y: number }, x: number, y: number): boolean {
  return Math.hypot(point.x - x, point.y - y) <= WALL_CROSSING_ENDPOINT_TOLERANCE_PX
}

export function wallSegmentsProperlyCross(a: WallSegment, b: WallSegment): boolean {
  const point = segmentIntersectionPoint(a, b)
  if (!point) return false
  return !(
    isNear(point, a.x1, a.y1) ||
    isNear(point, a.x2, a.y2) ||
    isNear(point, b.x1, b.y1) ||
    isNear(point, b.x2, b.y2)
  )
}

/** For the drawing tool: how many existing walls the new segment properly crosses. O(W). */
export function countWallsProperlyCrossedBySegment(segment: WallSegment, walls: readonly WallSegment[]): number {
  let count = 0
  for (const wall of walls) {
    if (wallSegmentsProperlyCross(segment, wall)) count += 1
  }
  return count
}

/** For file load: pair scan with early exit. O(W^2) worst case. */
export function hasAnyProperWallCrossing(walls: readonly WallSegment[]): boolean {
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      if (wallSegmentsProperlyCross(walls[i], walls[j])) return true
    }
  }
  return false
}
