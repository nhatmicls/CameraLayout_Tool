import { describe, expect, it } from 'vitest'
import { floorPositionPrefix } from './floor-label-prefix'

describe('floorPositionPrefix', () => {
  it('is always "F{position}_" (1-based), even for a single floor', () => {
    expect(floorPositionPrefix(0)).toBe('F1_')
    expect(floorPositionPrefix(1)).toBe('F2_')
    expect(floorPositionPrefix(2)).toBe('F3_')
  })
})
