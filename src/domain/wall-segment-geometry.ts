/**
 * Segment primitives for wall occlusion. Everything here is image px in a
 * y-down plane; no metres, no scale, no viewport. `WALL_MOUNT_CLEARANCE_M`
 * is exported as a constant only - the canvas converts it to px.
 */

export interface WallSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Shorter segments are not walls: dropped on load, never created by the drawing tool. */
export const MIN_WALL_LENGTH_PX = 1

/** A wall this close to a camera is taken to be the wall it is mounted on and does not block that camera. */
export const WALL_MOUNT_CLEARANCE_M = 0.3

/** Below this |cross product| two directions count as parallel (no single intersection). */
const PARALLEL_EPSILON = 1e-12
/** A ray hit closer than this to the origin is the origin itself, not an obstacle. */
const RAY_MIN_DISTANCE_PX = 1e-9
/**
 * Slack on the segment parameter of a ray hit. Without it a ray aimed exactly
 * at a corner shared by two walls can miss both by float noise and leak
 * through the corner.
 */
const RAY_SEGMENT_PARAM_SLACK = 1e-9

export function wallSegmentLengthPx(s: WallSegment): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
}

/** True when both segments join the same two points, in either direction (exact coordinates, as snapping produces). */
export function isSameWallSegment(a: WallSegment, b: WallSegment): boolean {
  return (
    (a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2) ||
    (a.x1 === b.x2 && a.y1 === b.y2 && a.x2 === b.x1 && a.y2 === b.y1)
  )
}

export function distancePointToSegmentPx(px: number, py: number, s: WallSegment): number {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - s.x1, py - s.y1)
  const t = Math.min(1, Math.max(0, ((px - s.x1) * dx + (py - s.y1) * dy) / lengthSq))
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy))
}

/** Part of `s` inside the disc centred on (0,0); null when fully outside (or only touching it). */
export function clipSegmentToDisc(s: WallSegment, radiusPx: number): WallSegment | null {
  const dx = s.x2 - s.x1
  const dy = s.y2 - s.y1
  const a = dx * dx + dy * dy
  const c = s.x1 * s.x1 + s.y1 * s.y1 - radiusPx * radiusPx
  if (a === 0) return c <= 0 ? s : null

  const b = 2 * (s.x1 * dx + s.y1 * dy)
  const discriminant = b * b - 4 * a * c
  if (discriminant <= 0) return null

  const root = Math.sqrt(discriminant)
  const tEnter = Math.max(0, (-b - root) / (2 * a))
  const tExit = Math.min(1, (-b + root) / (2 * a))
  if (tEnter >= tExit) return null
  if (tEnter === 0 && tExit === 1) return s

  return {
    x1: s.x1 + tEnter * dx,
    y1: s.y1 + tEnter * dy,
    x2: s.x1 + tExit * dx,
    y2: s.y1 + tExit * dy,
  }
}

/** Crossing point of two segments (endpoint touches included); null when parallel / collinear / not touching. */
export function segmentIntersectionPoint(a: WallSegment, b: WallSegment): { x: number; y: number } | null {
  const ax = a.x2 - a.x1
  const ay = a.y2 - a.y1
  const bx = b.x2 - b.x1
  const by = b.y2 - b.y1
  const denominator = ax * by - ay * bx
  if (Math.abs(denominator) < PARALLEL_EPSILON) return null

  const ox = b.x1 - a.x1
  const oy = b.y1 - a.y1
  const t = (ox * by - oy * bx) / denominator
  const u = (ox * ay - oy * ax) / denominator
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.x1 + t * ax, y: a.y1 + t * ay }
}

/**
 * Distance along the ray from (0,0) in the UNIT direction (dx,dy) to `s`;
 * Infinity when the ray misses the segment or runs parallel to it.
 */
export function rayFromOriginHitDistance(dx: number, dy: number, s: WallSegment): number {
  const ex = s.x2 - s.x1
  const ey = s.y2 - s.y1
  const denominator = dx * ey - dy * ex
  if (Math.abs(denominator) < PARALLEL_EPSILON) return Infinity

  const distance = (s.x1 * ey - s.y1 * ex) / denominator
  if (distance <= RAY_MIN_DISTANCE_PX) return Infinity
  const u = (s.x1 * dy - s.y1 * dx) / denominator
  if (u < -RAY_SEGMENT_PARAM_SLACK || u > 1 + RAY_SEGMENT_PARAM_SLACK) return Infinity
  return distance
}

/** Only opaque walls occlude; glass is drawn for reference. */
export function selectOpaqueWallSegments<T extends WallSegment & { kind: string }>(walls: readonly T[]): T[] {
  return walls.filter((wall) => wall.kind === 'opaque')
}
