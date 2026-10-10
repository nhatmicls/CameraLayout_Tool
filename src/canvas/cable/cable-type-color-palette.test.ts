import { describe, expect, it } from 'vitest'
import { SENSOR_MARKER_TINT } from '../sensor/sensor-kind-color-palette'
import {
  BRAND_TINTS,
  DORI_BAND_COLORS,
  resolveMarkerZoomCapScale,
  WALL_GLASS_COLOR,
  WALL_OPAQUE_COLOR,
  WALL_SELECTED_COLOR,
} from '../shared/brand-and-dori-color-palette'
import {
  CABLE_OVER_LIMIT_COLOR,
  CABLE_TYPE_COLORS,
  cableTypeColor,
  computeCableLabelFontSizePx,
  computeCableStrokeWidthPx,
  resolveCableSnapTolerancePx,
} from './cable-type-color-palette'

describe('cable type colours', () => {
  it('has 8 unique colours', () => {
    expect(CABLE_TYPE_COLORS).toHaveLength(8)
    expect(new Set(CABLE_TYPE_COLORS).size).toBe(8)
  })

  it('repeats no DORI, brand, wall, sensor or over-limit colour', () => {
    const taken = [
      ...Object.values(DORI_BAND_COLORS),
      ...Object.values(BRAND_TINTS),
      ...Object.values(SENSOR_MARKER_TINT),
      WALL_OPAQUE_COLOR,
      WALL_GLASS_COLOR,
      WALL_SELECTED_COLOR,
      CABLE_OVER_LIMIT_COLOR,
    ]
    for (const color of CABLE_TYPE_COLORS) expect(taken).not.toContain(color)
  })

  it('wraps by index and falls back to grey for an unknown type', () => {
    expect(cableTypeColor(0)).toBe(CABLE_TYPE_COLORS[0])
    expect(cableTypeColor(8)).toBe(CABLE_TYPE_COLORS[0])
    expect(cableTypeColor(11)).toBe(CABLE_TYPE_COLORS[3])
    expect(cableTypeColor(-1)).toBe('#6b7280')
  })
})

describe('cable sizes', () => {
  it('floors the stroke width at 1.5 px', () => {
    expect(computeCableStrokeWidthPx(12)).toBe(1.5)
    expect(computeCableStrokeWidthPx(40)).toBe(4)
  })

  it('takes the larger of the screen tolerance and the icon radius', () => {
    expect(resolveCableSnapTolerancePx(0.25, 12)).toBe(40) // zoomed out: 10 screen px = 40 image px
    expect(resolveCableSnapTolerancePx(0.28, 40)).toBe(40) // 11.2 screen px icon, under its cap: the icon is the bigger target
    expect(resolveCableSnapTolerancePx(4, 12)).toBe(3) // zoomed in: the icon is drawn at its 12 screen px cap = 3 image px
  })
})

describe('computeCableLabelFontSizePx', () => {
  const BASE = Math.max(9, 12 * 0.6) // iconRadiusPx = 12 -> 9 (the floor, since 12*0.6 = 7.2)

  it('not interactive: base size regardless of zoom (the PNG never caps)', () => {
    expect(computeCableLabelFontSizePx(12, 0.1, false)).toBe(BASE)
    expect(computeCableLabelFontSizePx(12, 10, false)).toBe(BASE)
  })

  it('interactive but below the zoom cap: base size', () => {
    expect(computeCableLabelFontSizePx(12, 0.5, true)).toBeCloseTo(BASE)
  })

  it('interactive and zoomed in past the cap: shrinks so the on-screen size stays constant', () => {
    const cappedScale = resolveMarkerZoomCapScale(12, 4, true)
    expect(cappedScale).toBeLessThan(1)
    expect(computeCableLabelFontSizePx(12, 4, true)).toBeCloseTo(BASE * cappedScale)
  })
})
