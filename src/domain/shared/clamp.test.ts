import { describe, expect, it } from 'vitest'
import { clamp, clampPointToImageBounds, clampPointToImageBoundsAlongRay } from './clamp'

describe('clamp', () => {
  it('passes through an in-range value', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps below min and above max', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('handles min === max', () => {
    expect(clamp(5, 3, 3)).toBe(3)
  })
})

describe('clampPointToImageBounds', () => {
  it('passes through a point already inside the image', () => {
    expect(clampPointToImageBounds({ x: 10, y: 20 }, 100, 200)).toEqual({ x: 10, y: 20 })
  })

  it('clamps a point outside the image on either axis independently', () => {
    expect(clampPointToImageBounds({ x: -5, y: 300 }, 100, 200)).toEqual({ x: 0, y: 200 })
    expect(clampPointToImageBounds({ x: 150, y: -10 }, 100, 200)).toEqual({ x: 100, y: 0 })
  })
})

describe('clampPointToImageBoundsAlongRay', () => {
  it('passes through a point already inside the image', () => {
    expect(clampPointToImageBoundsAlongRay({ x: 10, y: 10 }, { x: 50, y: 60 }, 1000, 800)).toEqual({ x: 50, y: 60 })
  })

  it('shortens a diagonal beam onto the edge it actually crosses, preserving its direction', () => {
    // TX at (900, 100) on a 1000x800 image, aimed 45deg (equal dx/dy), typed far too long - must
    // land on the right edge at (1000, 200), not bend to the bottom-right corner.
    const result = clampPointToImageBoundsAlongRay({ x: 900, y: 100 }, { x: 1300, y: 500 }, 1000, 800)
    expect(result).toEqual({ x: 1000, y: 200 })
  })

  it('shortens an axis-aligned horizontal beam onto the right edge', () => {
    expect(clampPointToImageBoundsAlongRay({ x: 100, y: 50 }, { x: 2000, y: 50 }, 1000, 800)).toEqual({ x: 1000, y: 50 })
  })

  it('shortens an axis-aligned vertical beam onto the bottom edge', () => {
    expect(clampPointToImageBoundsAlongRay({ x: 50, y: 100 }, { x: 50, y: 5000 }, 1000, 800)).toEqual({ x: 50, y: 800 })
  })

  it('collapses to the origin when the TX is already on the edge and aimed further out', () => {
    // Geometrically correct (the ray exits immediately) - callers that need a minimum beam
    // length (e.g. the properties panel) must guard against this themselves.
    expect(clampPointToImageBoundsAlongRay({ x: 0, y: 300 }, { x: -500, y: 300 }, 1000, 800)).toEqual({ x: 0, y: 300 })
  })
})
