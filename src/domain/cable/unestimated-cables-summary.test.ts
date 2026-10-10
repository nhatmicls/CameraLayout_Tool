import { describe, expect, it } from 'vitest'
import { describeUnestimatedCables, describeUnestimatedReason } from './unestimated-cables-summary'
import type { CableEstimateWarning } from './cable-layout-estimate'

describe('describeUnestimatedCables', () => {
  it('is null when count is 0', () => {
    expect(describeUnestimatedCables(0, [])).toBeNull()
  })

  it('singular vs plural noun', () => {
    const warnings: CableEstimateWarning[] = [{ code: 'linked-floor-scale-not-set', cableId: 'c1', message: 'x' }]
    expect(describeUnestimatedCables(1, warnings)).toBe('1 cable not estimated: a linked floor has no scale set (1).')
    expect(describeUnestimatedCables(2, warnings)).toBe('2 cables not estimated: a linked floor has no scale set (1).')
  })

  it('breaks down by reason, ignoring unrelated warnings (no cableId, or a different code)', () => {
    const warnings: CableEstimateWarning[] = [
      { code: 'linked-floor-scale-not-set', cableId: 'c1', message: 'x' },
      { code: 'linked-floor-scale-not-set', cableId: 'c2', message: 'x' },
      { code: 'link-cycle', cableId: 'c3', message: 'y' },
      { code: 'scale-not-set', message: 'project-wide, no cableId' },
      { code: 'cable-over-limit', cableId: 'c4', message: 'unrelated to being unestimated' },
    ]
    expect(describeUnestimatedCables(3, warnings)).toBe(
      '3 cables not estimated: a linked floor has no scale set (2); its cross-floor route forms a cycle (1).',
    )
  })

  it('falls back to a plain count when no matching warning is found', () => {
    expect(describeUnestimatedCables(2, [])).toBe('2 cables not estimated.')
  })

})

describe('describeUnestimatedReason', () => {
  it('reads the matching REASON_LABELS text for an exclusion code', () => {
    expect(describeUnestimatedReason('linked-floor-scale-not-set')).toBe('a linked floor has no scale set')
    expect(describeUnestimatedReason('link-cycle')).toBe('its cross-floor route forms a cycle')
  })

  it('null for a warning code that is never an exclusion reason', () => {
    expect(describeUnestimatedReason('cable-over-limit')).toBeNull()
    expect(describeUnestimatedReason('scale-not-set')).toBeNull()
    expect(describeUnestimatedReason('shaft-cable-not-routed')).toBeNull()
  })
})
