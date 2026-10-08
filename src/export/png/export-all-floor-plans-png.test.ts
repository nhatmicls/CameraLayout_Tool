import { describe, expect, it } from 'vitest'
import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS } from '../../domain/cable/cable-layout-types'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../../domain/fire-alarm/fire-alarm-device-types'
import { createEmptyFloor, type Floor } from '../../domain/floor/floor-types'
import type { Project } from '../../domain/project-file/project-types'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { exportAllFloorPlansPng } from './export-all-floor-plans-png'

const SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

function imagedFloor(id: string, name: string, overrides: Partial<Floor> = {}): Floor {
  return {
    ...createEmptyFloor(id, name),
    image: { dataUrl: 'data:image/png;base64,AAAA', widthPx: 100, heightPx: 100, fileName: `${id}.png` },
    scale: SCALE,
    ...overrides,
  }
}

function project(floors: Floor[]): Project {
  return {
    floors,
    shafts: [],
    cableTypes: createDefaultCableTypes(),
    cableSettings: { ...DEFAULT_CABLE_SETTINGS },
    fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
  }
}

/**
 * This suite runs in Vitest's `node` environment (no DOM/canvas, no `Image`
 * global - `vite.config.ts`'s own setting, not something this test
 * controls) - a REAL floor (image + scale) therefore always fails inside
 * `decodeEmbeddedImage`'s `new Image()` with a real `ReferenceError`,
 * caught by `exportAllFloorPlansPng`'s own try/catch. That is exploited
 * here, deliberately, as a no-mocks way to prove the M2 review fix: the
 * loop must visit every floor and record each outcome correctly instead of
 * stopping at the first failure. (The success path - an actual PNG
 * download - is covered by the Playwright e2e spec, which runs in a real
 * browser.)
 */
describe('exportAllFloorPlansPng - M2 review fix: continues past a failing floor', () => {
  it('visits every floor, categorising each as failed/skipped by reason - never stops early', async () => {
    const floors = [
      imagedFloor('f1', 'Floor 1'),
      imagedFloor('f2', 'Floor 2'),
      { ...createEmptyFloor('f3', 'Floor 3'), scale: null }, // no image at all
      imagedFloor('f4', 'Floor 4', { scale: null }), // image but never calibrated
    ]

    const result = await exportAllFloorPlansPng({ project: project(floors), viewConfig: DEFAULT_VIEW_CONFIG, delayMs: 0 })

    // Both "real" floors were ATTEMPTED (not skipped) and both failed for the SAME environment
    // reason - proves the second one was reached even though the first one threw.
    expect(result.failed.map((f) => f.position)).toEqual([1, 2])
    expect(result.failed[0].name).toBe('Floor 1')
    expect(result.failed[1].name).toBe('Floor 2')
    expect(result.failed.every((f) => f.message.length > 0)).toBe(true)

    expect(result.skipped).toEqual([
      { position: 3, name: 'Floor 3', reason: 'no-image' },
      { position: 4, name: 'Floor 4', reason: 'no-scale' },
    ])
    expect(result.exported).toEqual([])
  })

  it('an all-skipped project (no real floor to attempt) exports nothing and fails nothing', async () => {
    const floors = [{ ...createEmptyFloor('f1', 'Floor 1'), scale: null }, imagedFloor('f2', 'Floor 2', { scale: null })]
    const result = await exportAllFloorPlansPng({ project: project(floors), viewConfig: DEFAULT_VIEW_CONFIG, delayMs: 0 })
    expect(result.exported).toEqual([])
    expect(result.failed).toEqual([])
    expect(result.skipped.map((f) => f.reason)).toEqual(['no-image', 'no-scale'])
  })
})
