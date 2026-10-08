import { describe, expect, it } from 'vitest'
import { describeExportAllFloorsOutcome } from './describe-export-all-floors-outcome'

describe('describeExportAllFloorsOutcome (M2 review fix)', () => {
  it('names every exported floor by position and name when nothing was skipped or failed', () => {
    const text = describeExportAllFloorsOutcome([{ position: 1, name: 'Floor 1' }, { position: 2, name: 'Floor 2' }], [], [])
    expect(text).toBe('Exported: F1 Floor 1, F2 Floor 2.')
  })

  it('lists skipped floors with their reason', () => {
    const text = describeExportAllFloorsOutcome(
      [{ position: 1, name: 'Floor 1' }],
      [{ position: 3, name: 'Floor 3', reason: 'no-scale' }],
      [],
    )
    expect(text).toBe('Exported: F1 Floor 1. Skipped: F3 Floor 3 (no scale set).')
  })

  it('lists failed floors with their error message, and continues naming the rest', () => {
    const text = describeExportAllFloorsOutcome(
      [],
      [{ position: 3, name: 'Floor 3', reason: 'no-image' }],
      [{ position: 1, name: 'Floor 1', message: 'boom' }, { position: 2, name: 'Floor 2', message: 'also boom' }],
    )
    expect(text).toBe('Skipped: F3 Floor 3 (no plan image). Failed: F1 Floor 1 (boom), F2 Floor 2 (also boom).')
  })

  it('is an empty string when all three lists are empty (defensive)', () => {
    expect(describeExportAllFloorsOutcome([], [], [])).toBe('')
  })
})
