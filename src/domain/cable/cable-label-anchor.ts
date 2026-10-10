import type { CablePoint } from './cable-layout-types'

/** How far along a cable's / shaft leg's path its label is anchored, from the start. */
export const CABLE_LABEL_ROUTE_FRACTION = 0.4

export interface CableLabelAnchor {
  x: number
  y: number
  /** Unit normal of the segment the anchor sits on, always pointing "up" (`normalY <= 0`); a vertical segment ties to `+x`. */
  normalX: number
  normalY: number
  /** Segment angle, normalised to `(-90, 90]` so the label text is never drawn upside down. */
  angleDeg: number
}

/** `(-180, 180]` -> `(-90, 90]`: a line read right-to-left or bottom-to-top is flipped 180 degrees. */
function normalizeAngleDeg(angleDeg: number): number {
  if (angleDeg <= -90) return angleDeg + 180
  if (angleDeg > 90) return angleDeg - 180
  return angleDeg
}

/** The perpendicular of a unit direction `(dirX, dirY)` that points "up" (`y <= 0`); a vertical direction (`normalY === 0`) ties to `+x`. */
function computeUpwardNormal(dirX: number, dirY: number): { normalX: number; normalY: number } {
  let normalX = -dirY
  let normalY = dirX
  if (normalY > 0 || (normalY === 0 && normalX < 0)) {
    normalX = -normalX
    normalY = -normalY
  }
  // `-0` (from negating an already-zero component) reads as distinct from `0` to `toEqual` -
  // normalise it away; `x + 0` turns `-0` into `0` but leaves every other number unchanged.
  return { normalX: normalX + 0, normalY: normalY + 0 }
}

/**
 * Point at `fraction` of the polyline's own length (from its start), plus
 * the upward unit normal and the upright angle of whichever segment it
 * falls on. Zero-length segments (a repeated point) are skipped; `null` for
 * fewer than 2 points or a path whose total length is 0.
 */
export function computeCableLabelAnchor(path: readonly CablePoint[], fraction: number = CABLE_LABEL_ROUTE_FRACTION): CableLabelAnchor | null {
  if (path.length < 2) return null

  const segments: Array<{ a: CablePoint; b: CablePoint; length: number }> = []
  let totalLength = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (length === 0) continue
    segments.push({ a, b, length })
    totalLength += length
  }
  if (totalLength === 0) return null

  const targetDist = totalLength * fraction
  let accumulated = 0
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const reachable = accumulated + segment.length
    if (reachable >= targetDist || i === segments.length - 1) {
      const t = Math.min(1, Math.max(0, (targetDist - accumulated) / segment.length))
      const dx = segment.b.x - segment.a.x
      const dy = segment.b.y - segment.a.y
      const { normalX, normalY } = computeUpwardNormal(dx / segment.length, dy / segment.length)
      return {
        x: segment.a.x + dx * t,
        y: segment.a.y + dy * t,
        normalX,
        normalY,
        angleDeg: normalizeAngleDeg((Math.atan2(dy, dx) * 180) / Math.PI),
      }
    }
    accumulated = reachable
  }
  return null
}
