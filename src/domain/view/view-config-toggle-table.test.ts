import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW_CONFIG, type ViewConfig } from './view-config-types'
import {
  buildViewFilterNote,
  countHiddenViewToggles,
  isViewToggleOn,
  VIEW_TOGGLES,
  isViewTypeToggle,
  viewToggleSetState,
  withViewToggle,
  withViewToggleSet,
} from './view-config-toggle-table'

/** Every boolean a `ViewConfig` holds, as a flat path list. */
function booleanPaths(config: ViewConfig): string[] {
  const paths: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'boolean') paths.push(key)
    else for (const inner of Object.keys(value)) paths.push(`${key}.${inner}`)
  }
  return paths.sort()
}

const ALL_OFF = VIEW_TOGGLES.reduce((config, toggle) => withViewToggle(config, toggle.key, false), DEFAULT_VIEW_CONFIG)

describe('VIEW_TOGGLES', () => {
  it('has 16 entries with unique ids', () => {
    expect(VIEW_TOGGLES).toHaveLength(16)
    expect(new Set(VIEW_TOGGLES.map((toggle) => toggle.id)).size).toBe(16)
  })

  it('reaches every ViewConfig boolean exactly once', () => {
    const reached = VIEW_TOGGLES.map((toggle) => {
      const off = withViewToggle(DEFAULT_VIEW_CONFIG, toggle.key, false)
      const changed = booleanPaths(DEFAULT_VIEW_CONFIG).filter((path) => {
        const [outer, inner] = path.split('.') as [keyof ViewConfig, string | undefined]
        const value = inner ? (off[outer] as Record<string, boolean>)[inner] : off[outer]
        return value === false
      })
      expect(changed).toHaveLength(1)
      return changed[0]
    })
    expect([...reached].sort()).toEqual(booleanPaths(DEFAULT_VIEW_CONFIG))
  })

  it('lists the groups in panel order', () => {
    expect([...new Set(VIEW_TOGGLES.map((toggle) => toggle.group))]).toEqual(['cameras', 'sensors', 'cabling', 'walls'])
  })
})

describe('withViewToggle / isViewToggleOn', () => {
  it('round-trips every toggle without mutating the input', () => {
    for (const toggle of VIEW_TOGGLES) {
      const off = withViewToggle(DEFAULT_VIEW_CONFIG, toggle.key, false)
      expect(isViewToggleOn(off, toggle.key)).toBe(false)
      expect(isViewToggleOn(DEFAULT_VIEW_CONFIG, toggle.key)).toBe(true)
      expect(withViewToggle(off, toggle.key, true)).toEqual(DEFAULT_VIEW_CONFIG)
    }
  })
})

const inGroup = (group: string) => VIEW_TOGGLES.filter((toggle) => toggle.group === group)
const CAMERAS = inGroup('cameras')
const CAMERA_TYPES = CAMERAS.filter(isViewTypeToggle)
const SENSOR_KINDS = inGroup('sensors').filter(isViewTypeToggle)

describe('isViewTypeToggle', () => {
  it('picks the 5 form factors and the 4 sensor kinds, and nothing in cabling / walls', () => {
    expect(CAMERA_TYPES.map((toggle) => toggle.id)).toEqual(['camera-bullet', 'camera-dome', 'camera-turret', 'camera-ptz', 'camera-fisheye'])
    expect(SENSOR_KINDS.map((toggle) => toggle.id)).toEqual(['sensor-pir', 'sensor-beam', 'sensor-vibration', 'sensor-thermal'])
    expect([...inGroup('cabling'), ...inGroup('walls')].some(isViewTypeToggle)).toBe(false)
  })
})

describe('withViewToggleSet / viewToggleSetState', () => {
  it('unticking a whole group turns off every toggle in it and nothing outside it', () => {
    const off = withViewToggleSet(DEFAULT_VIEW_CONFIG, CAMERAS, false)
    expect(off.cameraMarkers).toBe(false)
    expect(off.cameraCones).toBe(false)
    expect(Object.values(off.cameraFormFactors)).toEqual([false, false, false, false, false])
    expect(viewToggleSetState(off, CAMERAS)).toBe('none')
    expect(countHiddenViewToggles(off)).toBe(7)
    for (const group of ['sensors', 'cabling', 'walls']) expect(viewToggleSetState(off, inGroup(group))).toBe('all')
    expect(viewToggleSetState(DEFAULT_VIEW_CONFIG, CAMERAS)).toBe('all') // the frozen default is not mutated
  })

  it('the "Types" parent covers the form factors only: markers and cones flags are untouched', () => {
    const off = withViewToggleSet(DEFAULT_VIEW_CONFIG, CAMERA_TYPES, false)
    expect(Object.values(off.cameraFormFactors)).toEqual([false, false, false, false, false])
    expect(off.cameraMarkers).toBe(true)
    expect(off.cameraCones).toBe(true)
    expect(viewToggleSetState(off, CAMERA_TYPES)).toBe('none')
    expect(viewToggleSetState(off, CAMERAS)).toBe('some')
    expect(viewToggleSetState(off, SENSOR_KINDS)).toBe('all')
  })

  it('is "some" as soon as one child differs, from either side', () => {
    const turretOff = withViewToggle(DEFAULT_VIEW_CONFIG, { formFactor: 'turret' }, false)
    expect(viewToggleSetState(turretOff, CAMERA_TYPES)).toBe('some')
    expect(viewToggleSetState(turretOff, CAMERAS)).toBe('some')
    const kindsOff = withViewToggleSet(DEFAULT_VIEW_CONFIG, SENSOR_KINDS, false)
    expect(viewToggleSetState(withViewToggle(kindsOff, { sensorKind: 'pir' }, true), SENSOR_KINDS)).toBe('some')
    // a flag row does not change the Types / Kinds parent
    expect(viewToggleSetState(withViewToggle(DEFAULT_VIEW_CONFIG, { flag: 'cameraCones' }, false), CAMERA_TYPES)).toBe('all')
    expect(viewToggleSetState(withViewToggle(DEFAULT_VIEW_CONFIG, { flag: 'cables' }, false), inGroup('cabling'))).toBe('some')
  })

  it('ticking a mixed or empty parent turns every toggle under it back on', () => {
    const mixed = withViewToggle(withViewToggleSet(DEFAULT_VIEW_CONFIG, CAMERAS, false), { formFactor: 'dome' }, true)
    expect(withViewToggleSet(mixed, CAMERAS, true)).toEqual(DEFAULT_VIEW_CONFIG)
    const typesOn = withViewToggleSet(ALL_OFF, CAMERA_TYPES, true)
    expect(viewToggleSetState(typesOn, CAMERA_TYPES)).toBe('all')
    expect(typesOn.cameraMarkers).toBe(false)
    expect(viewToggleSetState(typesOn, inGroup('cabling'))).toBe('none')
  })
})

describe('countHiddenViewToggles', () => {
  it('counts the toggles that are off', () => {
    expect(countHiddenViewToggles(DEFAULT_VIEW_CONFIG)).toBe(0)
    const two = withViewToggle(withViewToggle(DEFAULT_VIEW_CONFIG, { flag: 'cables' }, false), { formFactor: 'dome' }, false)
    expect(countHiddenViewToggles(two)).toBe(2)
    expect(countHiddenViewToggles(ALL_OFF)).toBe(16)
  })
})

describe('buildViewFilterNote', () => {
  it('is null when everything is shown', () => {
    expect(buildViewFilterNote(DEFAULT_VIEW_CONFIG)).toBeNull()
  })

  it('lists shown and hidden labels in table order', () => {
    const config = withViewToggle(withViewToggle(DEFAULT_VIEW_CONFIG, { flag: 'cables' }, false), { formFactor: 'dome' }, false)
    expect(buildViewFilterNote(config)).toEqual({
      shownText:
        'Shown: camera markers, FOV cones, bullet cameras, turret cameras, PTZ cameras, fisheye cameras, sensor markers, sensor coverage, PIR sensors, IR beams, vibration sensors, thermal cameras, hubs, walls',
      hiddenText: 'Hidden: dome cameras, cables',
    })
  })

  it('says "Shown: none" when every toggle is off', () => {
    const note = buildViewFilterNote(ALL_OFF)
    expect(note?.shownText).toBe('Shown: none')
    expect(note?.hiddenText.split(', ')).toHaveLength(16)
  })
})
