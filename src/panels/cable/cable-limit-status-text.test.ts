import { describe, expect, it } from 'vitest'
import type { CableLengthEstimate, CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import { cableLimitStatusText } from './cable-limit-status-text'

function estimateWith(limitStatus: CableLimitStatus, max: number | null = 90.779): CableLengthEstimate {
  return {
    cableId: 'k',
    typeId: 't',
    label: 'F1_C1_F1_H1',
    horizPx: 0,
    horizM: 0,
    deviceRiseM: 0,
    hubDropM: 0,
    hubExtraM: 0,
    slackM: 0,
    fixedM: 0,
    run: { nominal: 89.5, min: null, max },
    wasteM: 0,
    purchase: { nominal: 0, min: null, max: null },
    limitStatus,
  }
}

describe('cableLimitStatusText', () => {
  it('words each status', () => {
    expect(cableLimitStatusText(estimateWith('ok'), 90)).toBe('Within the 90 m limit')
    expect(cableLimitStatusText(estimateWith('maybe-over'), 90)).toBe('May exceed the 90 m limit (up to 90.8 m)')
    expect(cableLimitStatusText(estimateWith('over'), 90)).toBe('Exceeds the 90 m limit')
    expect(cableLimitStatusText(estimateWith('no-limit'), null)).toBe('No length limit set for this type')
  })

  it('falls back to the nominal run when there is no range', () => {
    expect(cableLimitStatusText(estimateWith('maybe-over', null), 90)).toBe('May exceed the 90 m limit (up to 89.5 m)')
  })
})
