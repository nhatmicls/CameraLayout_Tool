/**
 * Pure stage-transform math: no Konva/React imports, so the zoom/fit
 * arithmetic is unit-testable in isolation from the canvas. `use-stage-pan-zoom.ts`
 * is the thin React/Konva glue layer on top of this.
 */

export interface Viewport {
  x: number
  y: number
  scale: number
}

export const MIN_ZOOM_SCALE = 0.05
export const MAX_ZOOM_SCALE = 8
/** Per-wheel-event zoom multiplier. Fixed (not deltaY-proportional) so a fast trackpad pinch can't jump the zoom. */
export const WHEEL_ZOOM_FACTOR = 1.05
/** Multiplier used by the toolbar's +/- zoom buttons. */
export const BUTTON_ZOOM_FACTOR = 1.2

export function clampZoomScale(scale: number): number {
  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, scale))
}

/**
 * Viewport that fits an image of `imageWidth`x`imageHeight` inside a
 * container of `containerWidth`x`containerHeight`, centred, with a small
 * margin so edges aren't flush against the panel borders.
 */
export function computeFitViewport(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): Viewport {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, scale: 1 }
  }

  const FIT_MARGIN = 0.92
  const scale = clampZoomScale(Math.min(containerWidth / imageWidth, containerHeight / imageHeight) * FIT_MARGIN)
  const x = (containerWidth - imageWidth * scale) / 2
  const y = (containerHeight - imageHeight * scale) / 2
  return { x, y, scale }
}

/**
 * New viewport after zooming by `factor` (>1 = in, <1 = out) about a fixed
 * screen point `pivot` (e.g. the pointer for wheel-zoom, or the container
 * centre for the toolbar buttons). Keeps the image point under `pivot`
 * stationary on screen.
 */
export function zoomViewportAboutPoint(viewport: Viewport, pivot: { x: number; y: number }, factor: number): Viewport {
  const newScale = clampZoomScale(viewport.scale * factor)
  // Point in image space currently under the pivot, then re-solve for the
  // offset that keeps that same image point under the pivot at the new scale.
  const imagePointX = (pivot.x - viewport.x) / viewport.scale
  const imagePointY = (pivot.y - viewport.y) / viewport.scale
  return {
    x: pivot.x - imagePointX * newScale,
    y: pivot.y - imagePointY * newScale,
    scale: newScale,
  }
}
