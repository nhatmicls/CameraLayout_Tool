import type { WallSegment } from './wall-segment-geometry'

/**
 * Nearest wall endpoint (any wall kind) within `tolerancePx` of (x, y), or
 * null. Endpoints only - never a point on a wall's body. Returns the
 * endpoint's exact stored coordinates, so walls snapped together share
 * identical numbers. Equal distances resolve to the first wall in array order.
 *
 * Tolerance is IMAGE px. Callers convert from screen px (divide by the
 * viewport scale); this module never sees the viewport.
 */
export function findNearestWallEndpointWithinTolerance(
  x: number,
  y: number,
  walls: readonly WallSegment[],
  tolerancePx: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(tolerancePx) || tolerancePx <= 0) return null

  let bestDistanceSq = tolerancePx * tolerancePx
  let bestX = 0
  let bestY = 0
  let found = false
  const consider = (ex: number, ey: number) => {
    const distanceSq = (ex - x) * (ex - x) + (ey - y) * (ey - y)
    // Strict `<` once something is found keeps the first of two equally near endpoints.
    if (found ? distanceSq < bestDistanceSq : distanceSq <= bestDistanceSq) {
      bestDistanceSq = distanceSq
      bestX = ex
      bestY = ey
      found = true
    }
  }
  for (const wall of walls) {
    consider(wall.x1, wall.y1)
    consider(wall.x2, wall.y2)
  }
  return found ? { x: bestX, y: bestY } : null
}
