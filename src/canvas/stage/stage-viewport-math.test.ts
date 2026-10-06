import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM_SCALE,
  MIN_ZOOM_SCALE,
  clampZoomScale,
  computeFitViewport,
  zoomViewportAboutPoint,
} from './stage-viewport-math'

describe('clampZoomScale', () => {
  it('passes values inside the range through', () => {
    expect(clampZoomScale(1)).toBe(1)
  })

  it('clamps below the minimum', () => {
    expect(clampZoomScale(0.001)).toBe(MIN_ZOOM_SCALE)
  })

  it('clamps above the maximum', () => {
    expect(clampZoomScale(100)).toBe(MAX_ZOOM_SCALE)
  })
})

describe('computeFitViewport', () => {
  it('centres a smaller container-relative image and fits within the margin', () => {
    const viewport = computeFitViewport(1000, 500, 2000, 1000)
    // image is 2x container in both axes -> scale ~0.5 * margin
    expect(viewport.scale).toBeCloseTo(0.46, 2)
    expect(viewport.x).toBeCloseTo((1000 - 2000 * viewport.scale) / 2, 6)
    expect(viewport.y).toBeCloseTo((500 - 1000 * viewport.scale) / 2, 6)
  })

  it('is limited by the narrower axis', () => {
    // Tall image in a wide container: height is the binding constraint.
    const viewport = computeFitViewport(2000, 500, 1000, 1000)
    expect(viewport.scale).toBeCloseTo((500 / 1000) * 0.92, 6)
  })

  it('falls back to an identity viewport for degenerate inputs', () => {
    expect(computeFitViewport(0, 500, 100, 100)).toEqual({ x: 0, y: 0, scale: 1 })
    expect(computeFitViewport(500, 500, 0, 100)).toEqual({ x: 0, y: 0, scale: 1 })
  })
})

describe('zoomViewportAboutPoint', () => {
  it('keeps the image point under the pivot stationary on screen', () => {
    const viewport = { x: 0, y: 0, scale: 1 }
    const pivot = { x: 200, y: 150 }

    const zoomed = zoomViewportAboutPoint(viewport, pivot, 2)

    // The image point that was under the pivot before zooming...
    const imageX = (pivot.x - viewport.x) / viewport.scale
    const imageY = (pivot.y - viewport.y) / viewport.scale
    // ...must map back to the same screen pivot after zooming.
    expect(imageX * zoomed.scale + zoomed.x).toBeCloseTo(pivot.x, 6)
    expect(imageY * zoomed.scale + zoomed.y).toBeCloseTo(pivot.y, 6)
    expect(zoomed.scale).toBeCloseTo(2, 6)
  })

  it('clamps the resulting scale', () => {
    const viewport = { x: 0, y: 0, scale: MAX_ZOOM_SCALE }
    const zoomed = zoomViewportAboutPoint(viewport, { x: 0, y: 0 }, 2)
    expect(zoomed.scale).toBe(MAX_ZOOM_SCALE)
  })
})
