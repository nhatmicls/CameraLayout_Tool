import { describe, expect, it } from 'vitest'
import { describeFloorsWithoutCableScale } from './floors-without-cable-scale-note'

describe('describeFloorsWithoutCableScale', () => {
  it('is null for an empty list', () => {
    expect(describeFloorsWithoutCableScale([])).toBeNull()
  })

  it('names one floor by its tab position and name', () => {
    expect(describeFloorsWithoutCableScale([{ position: 2, name: 'Level 2' }])).toBe('No cable metres for F2 Level 2: scale not set.')
  })

  it('lists several floors in the given order', () => {
    expect(
      describeFloorsWithoutCableScale([
        { position: 2, name: 'Level 2' },
        { position: 3, name: 'Level 3' },
      ]),
    ).toBe('No cable metres for F2 Level 2, F3 Level 3: scale not set.')
  })
})
