import { describe, expect, it } from 'vitest'
import { computeIconRadiusPx } from './brand-and-dori-color-palette'

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
