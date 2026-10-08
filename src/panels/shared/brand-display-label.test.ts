import { describe, expect, it } from 'vitest'
import { brandDisplayLabel } from './brand-display-label'

describe('brandDisplayLabel', () => {
  it('capitalizes the first letter of an ordinary brand id', () => {
    expect(brandDisplayLabel('hikvision')).toBe('Hikvision')
  })

  it('uses the printed spelling for a brand with inner capitals', () => {
    expect(brandDisplayLabel('aolin')).toBe('AoLin')
  })
})
