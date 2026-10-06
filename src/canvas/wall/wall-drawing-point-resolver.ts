import { findNearestWallEndpointWithinTolerance } from '../../domain/wall/wall-endpoint-snap-lookup'
import type { WallSegment } from '../../domain/wall/wall-segment-geometry'

export interface WallDrawingPoint {
  x: number
  y: number
  /** True when the point was pulled onto an existing endpoint (the overlay then shows the snap ring). */
  snapped: boolean
}

export interface WallDrawingPointContext {
  imageWidthPx: number
  imageHeightPx: number
  walls: readonly WallSegment[]
  /** Last placed point of the chain in progress, if any. A candidate itself: before the first segment exists it is not a stored endpoint yet. */
  anchor: { x: number; y: number } | null
  /** IMAGE px - the caller has already divided the screen tolerance by the viewport scale. */
  snapTolerancePx: number
}

/**
 * Where a pointer position lands while drawing walls: clamped to the image
 * rectangle, then snapped to the nearest wall endpoint (any kind) or to the
 * chain's own anchor when within tolerance. Every pointer position - hover
 * and click alike - goes through here, so the ring always shows exactly
 * where a click would land, and "click the last point to finish" is just a
 * snap onto the anchor.
 */
export function resolveWallDrawingPoint(raw: { x: number; y: number }, context: WallDrawingPointContext): WallDrawingPoint {
  const x = Math.min(context.imageWidthPx, Math.max(0, raw.x))
  const y = Math.min(context.imageHeightPx, Math.max(0, raw.y))

  const endpoint = findNearestWallEndpointWithinTolerance(x, y, context.walls, context.snapTolerancePx)
  if (endpoint) return { ...endpoint, snapped: true }

  const { anchor } = context
  if (anchor && Math.hypot(anchor.x - x, anchor.y - y) <= context.snapTolerancePx) {
    return { x: anchor.x, y: anchor.y, snapped: true }
  }
  return { x, y, snapped: false }
}
