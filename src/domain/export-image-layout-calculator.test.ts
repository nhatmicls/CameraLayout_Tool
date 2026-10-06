import { describe, expect, it } from 'vitest'
import { computeBomStripLayout, computeExportScale } from './export-image-layout-calculator'

describe('computeBomStripLayout', () => {
  // Golden values for the current formula (font scales with width, clamped
  // 12-28px; row = 1.8x font; legend = 2.2x font; +1 row for the table
  // header). Deliberately literal - if the formula is retuned for looks,
  // update these numbers on purpose, not silently.
  it('1200px wide image, 2 BOM rows', () => {
    expect(computeBomStripLayout(1200, 2)).toEqual({
      fontPx: 14,
      rowHeightPx: 25,
      legendHeightPx: 31,
      stripHeightPx: 106,
    })
  })

  it('6000px wide image, 6 BOM rows (font clamped at the 28px max)', () => {
    expect(computeBomStripLayout(6000, 6)).toEqual({
      fontPx: 28,
      rowHeightPx: 50,
      legendHeightPx: 62,
      stripHeightPx: 412,
    })
  })

  it('handles zero BOM rows (legend + header row only)', () => {
    const layout = computeBomStripLayout(1200, 0)
    expect(layout.stripHeightPx).toBe(layout.legendHeightPx + layout.rowHeightPx)
  })

  it('throws on non-positive width or negative row count', () => {
    expect(() => computeBomStripLayout(0, 2)).toThrow()
    expect(() => computeBomStripLayout(-100, 2)).toThrow()
    expect(() => computeBomStripLayout(1200, -1)).toThrow()
    expect(() => computeBomStripLayout(NaN, 2)).toThrow()
  })

  it('defaults to legendLineCount 1, identical to the pre-sensor result', () => {
    expect(computeBomStripLayout(1200, 2, 1)).toEqual(computeBomStripLayout(1200, 2))
  })

  it('2 legend lines adds exactly one legend height to the strip total', () => {
    const oneLine = computeBomStripLayout(1200, 2, 1)
    const twoLines = computeBomStripLayout(1200, 2, 2)
    expect(twoLines.legendHeightPx).toBe(oneLine.legendHeightPx * 2)
    expect(twoLines.stripHeightPx - oneLine.stripHeightPx).toBe(oneLine.legendHeightPx)
    // fontPx/rowHeightPx are unaffected by the legend line count.
    expect(twoLines.fontPx).toBe(oneLine.fontPx)
    expect(twoLines.rowHeightPx).toBe(oneLine.rowHeightPx)
  })

  it('throws on a non-positive or non-integer legendLineCount', () => {
    expect(() => computeBomStripLayout(1200, 2, 0)).toThrow()
    expect(() => computeBomStripLayout(1200, 2, -1)).toThrow()
    expect(() => computeBomStripLayout(1200, 2, 1.5)).toThrow()
  })
})

describe('computeExportScale', () => {
  it('returns 1 (no downscale) when well under both limits', () => {
    expect(computeExportScale(1000, 800, 16_777_216, 8192)).toBe(1)
  })

  it('downscales 6000x4200 against a 16,777,216px cap to a factor < 1 that stays under the limit', () => {
    const widthPx = 6000
    const heightPx = 4200
    const maxPixels = 16_777_216
    const scale = computeExportScale(widthPx, heightPx, maxPixels, 8192)
    expect(scale).toBeLessThan(1)
    const resultingArea = widthPx * scale * (heightPx * scale)
    expect(resultingArea).toBeLessThanOrEqual(maxPixels + 1) // +1 guards float rounding
  })

  it('applies the max-side rule even when area is within budget', () => {
    const widthPx = 20000
    const heightPx = 100
    const maxSidePx = 8192
    const scale = computeExportScale(widthPx, heightPx, 100_000_000, maxSidePx)
    expect(scale).toBeCloseTo(maxSidePx / widthPx, 6)
    expect(widthPx * scale).toBeLessThanOrEqual(maxSidePx + 0.001)
  })

  it('never upscales', () => {
    expect(computeExportScale(100, 100, 1_000_000_000, 100_000)).toBe(1)
  })

  it('throws on non-positive dimensions', () => {
    expect(() => computeExportScale(0, 100, 1000, 100)).toThrow()
    expect(() => computeExportScale(100, -1, 1000, 100)).toThrow()
  })
})
