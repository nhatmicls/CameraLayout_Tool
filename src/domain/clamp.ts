/**
 * Generic numeric clamp, shared by every min/max-bounded value in the app:
 * canvas drag commits (camera/sensor markers, beam ends), form inputs
 * (`ClampedNumberInput`), and export layout maths. Previously copied in six
 * different files - one shared definition here instead (DRY).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface Point {
  x: number
  y: number
}

/** Clamps a point to the image's pixel bounds [0, widthPx] x [0, heightPx] - the rule every draggable marker/beam end commits with. */
export function clampPointToImageBounds(point: Point, widthPx: number, heightPx: number): Point {
  return { x: clamp(point.x, 0, widthPx), y: clamp(point.y, 0, heightPx) }
}

/**
 * Shortens the segment from `origin` to `point` along its own direction so an out-of-bounds
 * `point` lands exactly on the first image edge the ray crosses, instead of clamping each axis
 * independently (which can swing the whole segment to a different bearing once only one axis
 * is out of bounds - e.g. a near-diagonal line that an axis-only clamp turns into a near-
 * vertical one). Returns `point` unchanged when it is already inside the bounds. Assumes
 * `origin` itself is inside the bounds.
 */
export function clampPointToImageBoundsAlongRay(origin: Point, point: Point, widthPx: number, heightPx: number): Point {
  if (point.x >= 0 && point.x <= widthPx && point.y >= 0 && point.y <= heightPx) return point
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  let t = 1
  if (dx > 0) t = Math.min(t, (widthPx - origin.x) / dx)
  else if (dx < 0) t = Math.min(t, (0 - origin.x) / dx)
  if (dy > 0) t = Math.min(t, (heightPx - origin.y) / dy)
  else if (dy < 0) t = Math.min(t, (0 - origin.y) / dy)
  t = Math.max(t, 0)
  return { x: origin.x + dx * t, y: origin.y + dy * t }
}
