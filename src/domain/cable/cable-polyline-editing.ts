import { distancePointToSegmentPx } from '../wall/wall-segment-geometry'
import { MAX_CABLE_POINTS, type CablePoint } from './cable-layout-types'

/**
 * Vertex edits of a cable's INTERMEDIATE points (the two ends belong to the
 * device and the hub and are never edited here). Each returns a new array,
 * or the SAME array when the edit does not apply (so callers can skip the
 * store write and the undo step).
 */

export function moveCablePoint(points: CablePoint[], index: number, to: CablePoint): CablePoint[] {
  if (index < 0 || index >= points.length) return points
  return points.map((point, i) => (i === index ? { x: to.x, y: to.y } : point))
}

export function removeCablePoint(points: CablePoint[], index: number): CablePoint[] {
  if (index < 0 || index >= points.length) return points
  return points.filter((_, i) => i !== index)
}

/**
 * Inserts `at` into the segment of `fullPath` ([device, ...points, hub])
 * nearest to it and returns the new INTERMEDIATE points. A path already at
 * `MAX_CABLE_POINTS` is returned unchanged (as its intermediate points).
 */
export function insertCablePointOnNearestSegment(fullPath: readonly CablePoint[], at: CablePoint): CablePoint[] {
  const points = fullPath.slice(1, -1)
  if (fullPath.length < 2 || points.length >= MAX_CABLE_POINTS) return points

  let bestSegment = 0
  let bestDistance = Infinity
  for (let i = 0; i < fullPath.length - 1; i++) {
    const a = fullPath[i]
    const b = fullPath[i + 1]
    const distance = distancePointToSegmentPx(at.x, at.y, { x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    if (distance < bestDistance) {
      bestDistance = distance
      bestSegment = i
    }
  }
  // Segment i joins fullPath[i] and fullPath[i + 1], so the new vertex lands at intermediate index i.
  return [...points.slice(0, bestSegment), { x: at.x, y: at.y }, ...points.slice(bestSegment)]
}
