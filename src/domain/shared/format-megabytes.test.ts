import { describe, expect, it } from 'vitest'
import { formatMegabytes } from './format-megabytes'

describe('formatMegabytes', () => {
  it('formats to one decimal place', () => {
    expect(formatMegabytes(1024 * 1024)).toBe('1.0')
    expect(formatMegabytes(1.5 * 1024 * 1024)).toBe('1.5')
  })

  it('is 0.0 for 0 bytes', () => {
    expect(formatMegabytes(0)).toBe('0.0')
  })
})
