import { describe, expect, it } from 'vitest'
import { computeIconRadiusPx, resolveMarkerZoomCapScale } from './brand-and-dori-color-palette'

describe('resolveMarkerZoomCapScale', () => {
  it('leaves the icon alone while it is under the screen cap', () => {
    expect(resolveMarkerZoomCapScale(12, 0.5, true)).toBe(1) // 6 screen px
    expect(resolveMarkerZoomCapScale(12, 1, true)).toBe(1) // exactly at the 12 screen px cap
  })

  it('holds the icon at the cap once zoomed in past it', () => {
    expect(resolveMarkerZoomCapScale(12, 4, true)).toBe(0.25)
    expect(40 * 2 * resolveMarkerZoomCapScale(40, 2, true)).toBeCloseTo(12, 6)
  })

  it('never scales a non-interactive (PNG export) scene', () => {
    expect(resolveMarkerZoomCapScale(40, 1, false)).toBe(1)
    expect(resolveMarkerZoomCapScale(12, 8, false)).toBe(1)
  })
})

describe('computeIconRadiusPx', () => {
  it('floors at 12px for a small (1200px long-edge) image', () => {
    expect(computeIconRadiusPx(1200)).toBe(12)
  })

  it('scales up for a large (6000px long-edge) image', () => {
    expect(computeIconRadiusPx(6000)).toBe(40)
  })

  it('is monotonically non-decreasing with image size', () => {
    expect(computeIconRadiusPx(3000)).toBeGreaterThanOrEqual(computeIconRadiusPx(1500))
  })
})
