import { describe, expect, it } from 'vitest'
import { sanitizeExportFileName } from './sanitize-export-file-name'

describe('sanitizeExportFileName', () => {
  it('strips the extension', () => {
    expect(sanitizeExportFileName('floorplan.png')).toBe('floorplan')
    expect(sanitizeExportFileName('floorplan.JPEG')).toBe('floorplan')
  })

  it('replaces spaces with dashes', () => {
    expect(sanitizeExportFileName('My Office Plan.png')).toBe('My-Office-Plan')
  })

  it('replaces unsafe characters and collapses repeats', () => {
    expect(sanitizeExportFileName('plan v2 (final)!!.jpg')).toBe('plan-v2-final')
  })

  it('trims leading/trailing dashes left over after sanitising', () => {
    expect(sanitizeExportFileName('-- weird --.png')).toBe('weird')
  })

  it('keeps existing dashes/underscores untouched', () => {
    expect(sanitizeExportFileName('warehouse_floor-1.png')).toBe('warehouse_floor-1')
  })

  it('falls back to a default stem when nothing printable survives', () => {
    expect(sanitizeExportFileName('***.png')).toBe('floor-plan')
    expect(sanitizeExportFileName('.png')).toBe('floor-plan')
  })

  it('only strips the final extension; any other dots are treated as unsafe and become dashes', () => {
    expect(sanitizeExportFileName('v1.2.plan.png')).toBe('v1-2-plan')
  })
})
