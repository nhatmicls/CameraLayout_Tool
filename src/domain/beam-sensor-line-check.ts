import { distancePointToSegmentPx, segmentIntersectionPoint, wallSegmentLengthPx, type WallSegment } from './wall-segment-geometry'

/** Relative slack on the over-distance check so a beam set to exactly the datasheet limit (metres-to-px-and-back float error) is never flagged as over. */
const OVER_DISTANCE_RELATIVE_TOLERANCE = 1e-9

export interface BeamLineCheck {
  lengthPx: number
  overMaxDistance: boolean
  /** Nearest opaque crossing to the transmitter (x1, y1); null when the beam is clear. */
  blockedAt: { x: number; y: number } | null
  /** True when the beam crosses at least one glass wall (allowed, shown as a note - glass never clips a beam). */
  crossesGlass: boolean
}

export interface CheckBeamLineInput {
  x1: number
  y1: number
  x2: number
  y2: number
  opaqueWalls: readonly WallSegment[]
  glassWalls: readonly WallSegment[]
  /** Walls within this distance of either end are the mounting wall, not an obstacle. */
  clearancePx: number
  maxDistancePx: number
}

function isMountingWall(wall: WallSegment, beam: WallSegment, clearancePx: number): boolean {
  return (
    distancePointToSegmentPx(beam.x1, beam.y1, wall) <= clearancePx ||
    distancePointToSegmentPx(beam.x2, beam.y2, wall) <= clearancePx
  )
}

/**
 * The crossing (if any) nearest the transmitter (beam.x1, beam.y1), ignoring
 * walls within `clearancePx` of either end. `segmentIntersectionPoint`
 * returns `null` for a wall running exactly along the beam (collinear
 * overlap) - documented, not fixed: such a wall counts as not blocking.
 */
function nearestCrossing(beam: WallSegment, walls: readonly WallSegment[], clearancePx: number): { x: number; y: number } | null {
  let nearest: { x: number; y: number } | null = null
  let nearestDistanceSq = Infinity
  for (const wall of walls) {
    if (isMountingWall(wall, beam, clearancePx)) continue
    const point = segmentIntersectionPoint(beam, wall)
    if (!point) continue
    const distanceSq = (point.x - beam.x1) ** 2 + (point.y - beam.y1) ** 2
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq
      nearest = point
    }
  }
  return nearest
}

/**
 * The transmitter-to-receiver line check for an active IR beam: its length,
 * whether that exceeds the model's distance limit for this placement
 * (`resolveBeamMaxDistanceM`'s `limitM`, converted to px by the caller), the
 * nearest opaque crossing (if any - a beam gets a blocked state instead of a
 * clip, per the plan's blocking table), and whether it also crosses glass
 * (allowed, but worth a note in the panel).
 */
export function checkBeamLine(input: CheckBeamLineInput): BeamLineCheck {
  const beam: WallSegment = { x1: input.x1, y1: input.y1, x2: input.x2, y2: input.y2 }
  const lengthPx = wallSegmentLengthPx(beam)
  const blockedAt = nearestCrossing(beam, input.opaqueWalls, input.clearancePx)
  const crossesGlass = nearestCrossing(beam, input.glassWalls, input.clearancePx) !== null
  const overMaxDistance = lengthPx > input.maxDistancePx * (1 + OVER_DISTANCE_RELATIVE_TOLERANCE)
  return { lengthPx, overMaxDistance, blockedAt, crossesGlass }
}
