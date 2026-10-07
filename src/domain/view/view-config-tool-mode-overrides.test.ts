import { describe, expect, it } from 'vitest'
import { VIEW_TOGGLES, isViewToggleOn, withViewToggle } from './view-config-toggle-table'
import { resolveEffectiveViewConfig, type ViewConfigToolMode } from './view-config-tool-mode-overrides'
import { DEFAULT_VIEW_CONFIG } from './view-config-types'

const ALL_OFF = VIEW_TOGGLES.reduce((config, toggle) => withViewToggle(config, toggle.key, false), DEFAULT_VIEW_CONFIG)
const ALL_MODES: ViewConfigToolMode[] = ['select', 'calibrate', 'wall', 'hub', 'riser', 'drop', 'cable']

/** Ids of the toggles that are on in the effective config for `toolMode`, starting from everything off. */
const forcedOn = (toolMode: ViewConfigToolMode) => {
  const effective = resolveEffectiveViewConfig(ALL_OFF, toolMode)
  return VIEW_TOGGLES.filter((toggle) => isViewToggleOn(effective, toggle.key)).map((toggle) => toggle.id)
}

describe('resolveEffectiveViewConfig', () => {
  it('forces nothing in select and calibrate (same object back)', () => {
    expect(resolveEffectiveViewConfig(ALL_OFF, 'select')).toBe(ALL_OFF)
    expect(resolveEffectiveViewConfig(ALL_OFF, 'calibrate')).toBe(ALL_OFF)
  })

  it('wall tool forces walls only', () => {
    expect(forcedOn('wall')).toEqual(['walls'])
  })

  it('hub / riser / drop tools force hubs only', () => {
    expect(forcedOn('hub')).toEqual(['hubs'])
    expect(forcedOn('riser')).toEqual(['hubs'])
    expect(forcedOn('drop')).toEqual(['hubs'])
  })

  it('cable tool forces hubs, cables and every device marker, but not cones / coverage / walls', () => {
    expect(forcedOn('cable')).toEqual([
      'camera-markers',
      'camera-bullet',
      'camera-dome',
      'camera-turret',
      'camera-ptz',
      'camera-fisheye',
      'sensor-markers',
      'sensor-pir',
      'sensor-beam',
      'sensor-vibration',
      'sensor-thermal',
      'hubs',
      'cables',
    ])
  })

  it('returns the same object when the tool is already satisfied', () => {
    for (const toolMode of ALL_MODES) expect(resolveEffectiveViewConfig(DEFAULT_VIEW_CONFIG, toolMode)).toBe(DEFAULT_VIEW_CONFIG)
    const conesOff = { ...DEFAULT_VIEW_CONFIG, cameraCones: false, sensorCoverage: false, walls: false }
    expect(resolveEffectiveViewConfig(conesOff, 'cable')).toBe(conesOff)
  })

  it('never forces anything off and never mutates the stored config', () => {
    for (const toolMode of ALL_MODES) {
      const effective = resolveEffectiveViewConfig(DEFAULT_VIEW_CONFIG, toolMode)
      expect(VIEW_TOGGLES.every((toggle) => isViewToggleOn(effective, toggle.key))).toBe(true)
      resolveEffectiveViewConfig(ALL_OFF, toolMode)
      expect(VIEW_TOGGLES.some((toggle) => isViewToggleOn(ALL_OFF, toggle.key))).toBe(false)
    }
  })
})
