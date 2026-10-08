import { describe, expect, it } from 'vitest'
import { describeUnestimatedCables } from './unestimated-cables-summary'
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

  it('H2: "shaft-exit-not-chosen" is one of the breakdown reasons too; with ALL THREE mixed, the breakdown sums to the count', () => {
    const warnings: CableEstimateWarning[] = [
      { code: 'linked-floor-scale-not-set', cableId: 'c1', message: 'x' },
      { code: 'link-cycle', cableId: 'c2', message: 'y' },
      { code: 'shaft-exit-not-chosen', cableId: 'c3', message: 'z' },
      { code: 'shaft-exit-not-chosen', cableId: 'c4', message: 'z' },
    ]
    const described = describeUnestimatedCables(4, warnings)
    expect(described).toBe(
      '4 cables not estimated: a linked floor has no scale set (1); its cross-floor route forms a cycle (1); no exit chosen for its shaft (2).',
    )
    // The breakdown's own counts sum back to the total passed in - never less (a forgotten reason
    // code would silently drop below `count` instead of failing to compile).
    const matches = [...described!.matchAll(/\((\d+)\)/g)].map((m) => Number(m[1]))
    expect(matches.reduce((sum, n) => sum + n, 0)).toBe(4)
  })
})
