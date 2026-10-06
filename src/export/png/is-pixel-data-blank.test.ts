import { describe, expect, it } from 'vitest'
import { isPixelDataBlank, type RgbaSample } from './is-pixel-data-blank'

describe('isPixelDataBlank', () => {
  it('treats zero samples as blank (nothing to prove it rendered)', () => {
    expect(isPixelDataBlank([])).toBe(true)
  })

  it('treats a canvas where every sample is identical white as blank', () => {
    const samples: RgbaSample[] = [
      [255, 255, 255, 255],
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    ]
    expect(isPixelDataBlank(samples)).toBe(true)
  })

  it('treats a canvas where every sample is identical transparent-black as blank', () => {
    const samples: RgbaSample[] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    expect(isPixelDataBlank(samples)).toBe(true)
  })

  it('treats a single sample as blank regardless of its colour (no variance possible)', () => {
    expect(isPixelDataBlank([[12, 200, 44, 255]])).toBe(true)
  })

  it('is not blank once at least one sample differs from the rest', () => {
    const samples: RgbaSample[] = [
      [255, 255, 255, 255],
      [255, 255, 255, 255],
      [21, 128, 61, 255], // a DORI band green, say
    ]
    expect(isPixelDataBlank(samples)).toBe(false)
  })
})
