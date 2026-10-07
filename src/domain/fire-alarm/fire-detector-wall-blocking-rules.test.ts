import { describe, expect, it } from 'vitest'
import type { FireDetectorKind } from './fire-alarm-device-types'
import { FIRE_DETECTOR_BLOCKING_WALL_KINDS } from './fire-detector-wall-blocking-rules'

const DETECTOR_KINDS: readonly FireDetectorKind[] = ['smoke-detector', 'heat-detector', 'co-detector']

describe('FIRE_DETECTOR_BLOCKING_WALL_KINDS', () => {
  it('blocks every detector kind with both opaque and glass walls', () => {
    for (const kind of DETECTOR_KINDS) {
      expect(FIRE_DETECTOR_BLOCKING_WALL_KINDS[kind]).toEqual(['opaque', 'glass'])
    }
  })

  it('is exhaustive over the three detector kinds, no more no less', () => {
    expect(Object.keys(FIRE_DETECTOR_BLOCKING_WALL_KINDS).sort()).toEqual([...DETECTOR_KINDS].sort())
  })
})
