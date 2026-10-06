import {
  MIN_WALL_LENGTH_PX,
  clipSegmentToDisc,
  distancePointToSegmentPx,
  rayFromOriginHitDistance,
  segmentIntersectionPoint,
  wallSegmentLengthPx,
  type WallSegment,
} from './wall-segment-geometry'
import { simplifyCollinearVertices } from './visibility-polygon-collinear-vertex-simplifier'

/**
 * What a camera can see around itself in 2D, as a polygon, given the opaque
 * walls. The polygon covers the FULL disc of radius `radiusPx`, not the HFOV
 * sector: the cone's own Arc bands already cut the sector, so rotating the
 * camera or changing its HFOV never invalidates this polygon.
 *
 * Method: ray casting to the nearest hit. Rays go out at 72 fixed bearings
 * plus, for every wall endpoint and every wall-wall crossing, at that bearing
 * and a hair either side of it (so the polygon turns the corner there).
 * Crossing, overlapping and duplicate walls need no special handling.
 */
export interface VisibilityPolygonInput {
  originX: number
  originY: number
  /** > 0, finite. */
  radiusPx: number
  /** Opaque walls only, image px. */
  segments: readonly WallSegment[]
  /** >= 0. Whole segments within this distance of the origin are ignored (the camera's mounting wall). */
  originClearancePx: number
}

const FIXED_RAY_COUNT = 72
const FIXED_RAY_STEP_RAD = (2 * Math.PI) / FIXED_RAY_COUNT
/**
 * Unobstructed rays end slightly outside the disc so that every chord between
 * two neighbouring fixed rays stays outside the true circle and the clip
 * never shaves the cone's round outer edge.
 */
const UNOBSTRUCTED_RADIUS_FACTOR = 1 / Math.cos(FIXED_RAY_STEP_RAD / 2)
/** Angular offset of the two extra rays either side of a corner, radians. 0.05 px at a 5000 px radius. */
const CORNER_RAY_OFFSET_RAD = 1e-5
/** A corner this close to the origin has no usable bearing. */
const MIN_CORNER_DISTANCE_PX = 1e-9

/** Keeps a bearing inside (-pi, pi] so the sorted list stays one clean turn around the origin. */
function wrapBearing(rad: number): number {
  if (rad > Math.PI) return rad - 2 * Math.PI
  if (rad <= -Math.PI) return rad + 2 * Math.PI
  return rad
}

function pushCornerBearings(bearings: number[], x: number, y: number): void {
  if (Math.hypot(x, y) < MIN_CORNER_DISTANCE_PX) return
  const bearing = Math.atan2(y, x)
  bearings.push(wrapBearing(bearing - CORNER_RAY_OFFSET_RAD), bearing, wrapBearing(bearing + CORNER_RAY_OFFSET_RAD))
}

/** Origin-relative copies of the segments that can actually occlude: long enough, outside the clearance, inside the range disc. */
function selectOccludingLocalSegments(input: VisibilityPolygonInput): WallSegment[] {
  const local: WallSegment[] = []
  for (const segment of input.segments) {
    const translated: WallSegment = {
      x1: segment.x1 - input.originX,
      y1: segment.y1 - input.originY,
      x2: segment.x2 - input.originX,
      y2: segment.y2 - input.originY,
    }
    if (wallSegmentLengthPx(translated) < MIN_WALL_LENGTH_PX) continue
    if (distancePointToSegmentPx(0, 0, translated) <= input.originClearancePx) continue
    const clipped = clipSegmentToDisc(translated, input.radiusPx)
    if (clipped && wallSegmentLengthPx(clipped) >= MIN_WALL_LENGTH_PX) local.push(clipped)
  }
  return local
}

/**
 * Returns `null` when nothing occludes (the caller then skips clipping
 * altogether), else a flat `[x0, y0, x1, y1, ...]` polygon relative to the
 * origin, in unrotated image axes, sorted by bearing and simplified (see
 * `simplifyCollinearVertices`) - a strictly fewer-or-equal-vertex polygon
 * tracing the exact same region.
 */
export function computeWallOcclusionVisibilityPolygon(input: VisibilityPolygonInput): number[] | null {
  const local = selectOccludingLocalSegments(input)
  if (local.length === 0) return null

  const bearings: number[] = []
  for (let n = 0; n < FIXED_RAY_COUNT; n++) bearings.push(-Math.PI + n * FIXED_RAY_STEP_RAD)
  for (let i = 0; i < local.length; i++) {
    const segment = local[i]
    pushCornerBearings(bearings, segment.x1, segment.y1)
    pushCornerBearings(bearings, segment.x2, segment.y2)
    for (let j = i + 1; j < local.length; j++) {
      const crossing = segmentIntersectionPoint(segment, local[j])
      if (crossing) pushCornerBearings(bearings, crossing.x, crossing.y)
    }
  }
  const sorted = Float64Array.from(bearings).sort()

  const unobstructedRadiusPx = input.radiusPx * UNOBSTRUCTED_RADIUS_FACTOR
  const polygon: number[] = []
  for (const bearing of sorted) {
    const dx = Math.cos(bearing)
    const dy = Math.sin(bearing)
    let nearest = Infinity
    for (const segment of local) {
      const distance = rayFromOriginHitDistance(dx, dy, segment)
      if (distance < nearest) nearest = distance
    }
    const reach = nearest === Infinity ? unobstructedRadiusPx : nearest
    polygon.push(reach * dx, reach * dy)
  }
  return simplifyCollinearVertices(polygon)
}
