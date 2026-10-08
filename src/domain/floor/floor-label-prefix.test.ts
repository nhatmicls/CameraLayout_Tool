import { describe, expect, it } from 'vitest'
import { floorLabelPrefix } from './floor-label-prefix'

describe('floorLabelPrefix', () => {
  it('is empty for a one-floor project, regardless of index', () => {
    expect(floorLabelPrefix(0, 1)).toBe('')
  })

  it('is empty for a zero-floor count (defensive)', () => {
    expect(floorLabelPrefix(0, 0)).toBe('')
  })

  it('is "F{position}-" (1-based) once the project has more than one floor', () => {
    expect(floorLabelPrefix(0, 3)).toBe('F1-')
    expect(floorLabelPrefix(1, 3)).toBe('F2-')
    expect(floorLabelPrefix(2, 3)).toBe('F3-')
  })
})
