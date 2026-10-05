import { describe, expect, it } from 'vitest'
import { deriveProjectFileName } from './project-file-save-and-load'

describe('deriveProjectFileName', () => {
  it('replaces the image extension with -camera-layout.json', () => {
    expect(deriveProjectFileName('warehouse-floor-plan.png')).toBe('warehouse-floor-plan-camera-layout.json')
  })

  it('handles file names with multiple dots by stripping only the last extension', () => {
    expect(deriveProjectFileName('site.v2.final.jpg')).toBe('site.v2.final-camera-layout.json')
  })

  it('falls back to "project" for a name with no usable base', () => {
    expect(deriveProjectFileName('.png')).toBe('project-camera-layout.json')
    expect(deriveProjectFileName('')).toBe('project-camera-layout.json')
  })
})
