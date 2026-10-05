/**
 * Pure 2D geometry for drawing a camera's field-of-view cone. Returns
 * angles/points for Konva's `Arc` shape (innerRadius, outerRadius, angle,
 * rotation) to consume directly - this module returns Arc parameters only.
 * Polygon vertices exist in one place, for wall occlusion:
 * `wall-occlusion-visibility-polygon.ts`.
 *
 * Convention: `rotationDeg` is the bearing of the optical axis, 0 = +x,
 * clockwise positive. This matches both the canvas's y-down coordinate
 * system and Konva's rotation convention, so no sign-flipping is needed at
 * the render layer.
 */

/** Normalises any angle in degrees to the range [0, 360). */
export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) {
    throw new Error(`deg must be finite, got ${deg}`)
  }
  const mod = deg % 360
  return mod < 0 ? mod + 360 : mod
}

/** Start angle (left edge) of the FOV sector, sweeping clockwise through `hfovDeg`. */
export function sectorStartDeg(rotationDeg: number, hfovDeg: number): number {
  return normalizeDegrees(rotationDeg - hfovDeg / 2)
}

/**
 * Bearing in degrees (0 = +x, clockwise positive) from (cx,cy) to (px,py) in
 * a y-down coordinate system. `atan2(dy, dx)` already yields a clockwise
 * angle here because the y axis points down, flipping the usual
 * counter-clockwise mathematical convention.
 */
export function bearingDegBetweenPoints(cx: number, cy: number, px: number, py: number): number {
  const dx = px - cx
  const dy = py - cy
  if (dx === 0 && dy === 0) {
    throw new Error('point coincides with centre; bearing is undefined')
  }
  return normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI)
}

/** Point at `dist` px from (cx,cy) along bearing `deg` (y-down, clockwise-positive). */
export function pointAtBearing(cx: number, cy: number, deg: number, dist: number): { x: number; y: number } {
  if (!Number.isFinite(dist) || dist < 0) {
    throw new Error(`dist must be a non-negative finite number, got ${dist}`)
  }
  const rad = (normalizeDegrees(deg) * Math.PI) / 180
  return { x: cx + dist * Math.cos(rad), y: cy + dist * Math.sin(rad) }
}

export type ConeSweepShape = 'sector' | 'half-disc' | 'full-circle'

/** How Konva should render the cone's outline: a pie sector, an exact half-disc, or a full circle. */
export function coneSweepShape(hfovDeg: number): ConeSweepShape {
  if (hfovDeg >= 360) return 'full-circle'
  if (hfovDeg === 180) return 'half-disc'
  return 'sector'
}
