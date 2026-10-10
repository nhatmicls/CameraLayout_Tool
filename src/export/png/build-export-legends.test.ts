import { describe, expect, it } from 'vitest'
import { EMPTY_CABLE_LAYOUT_ESTIMATE } from '../../domain/cable/cable-layout-estimate'
import { DEFAULT_CABLE_SETTINGS, createDefaultCableTypes, type Hub, type Shaft } from '../../domain/cable/cable-layout-types'
import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { DEFAULT_FIRE_ALARM_SETTINGS, type PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { buildExportLegends, describeFloorPosition, describeShaftsOnFloor, type FloorPositionContext } from './build-export-legends'
import type { ExportPlanPngOptions } from './export-plan-png'

describe('describeFloorPosition', () => {
  it('is null with no context (every pre-phase-7 caller)', () => {
    expect(describeFloorPosition(undefined)).toBeNull()
  })

  it('is null for a one-floor project, even with a context given', () => {
    const context: FloorPositionContext = { index: 0, count: 1, name: 'Floor 1' }
    expect(describeFloorPosition(context)).toBeNull()
  })

  it('is "F{position} of {count} - {name}" once there is more than one floor', () => {
    const context: FloorPositionContext = { index: 1, count: 3, name: 'Level 2' }
    expect(describeFloorPosition(context)).toBe('F2 of 3 - Level 2')
  })
})

describe('describeShaftsOnFloor', () => {
  const shafts: Shaft[] = [
    { id: 'shaft-1', name: 'Main riser' },
    { id: 'shaft-2', name: 'Back shaft' },
  ]

  it('is null when shafts is omitted (every pre-phase-7 caller)', () => {
    expect(describeShaftsOnFloor([], [], undefined, 3)).toBeNull()
  })

  it('is null when shafts exist project-wide but none have a marker on this floor', () => {
    const hubs: Hub[] = [{ id: 'hub-1', x: 0, y: 0, mountHeightM: 1.5 }]
    expect(describeShaftsOnFloor(hubs, ['H1'], shafts, 3)).toBeNull()
  })

  it('names the shaft(s) with a marker on this floor, by project-order label and name', () => {
    const hubs: Hub[] = [
      { id: 'hub-1', x: 0, y: 0, mountHeightM: 1.5 },
      { id: 'hub-2', kind: 'shaft', shaftId: 'shaft-1', x: 10, y: 10, mountHeightM: 0 },
    ]
    expect(describeShaftsOnFloor(hubs, ['H1', 'T1'], shafts, 3)).toBe('Shafts: T1 Main riser')
  })

  it('lists several shaft markers on the same floor in hub order', () => {
    const hubs: Hub[] = [
      { id: 'hub-2', kind: 'shaft', shaftId: 'shaft-2', x: 10, y: 10, mountHeightM: 0 },
      { id: 'hub-1', kind: 'shaft', shaftId: 'shaft-1', x: 0, y: 0, mountHeightM: 0 },
    ]
    expect(describeShaftsOnFloor(hubs, ['T2', 'T1'], shafts, 3)).toBe('Shafts: T2 Back shaft, T1 Main riser')
  })

  it('M5: is null for a one-floor project even with a marker on this floor (plan: strip notes only apply when floors > 1)', () => {
    const hubs: Hub[] = [{ id: 'hub-2', kind: 'shaft', shaftId: 'shaft-1', x: 10, y: 10, mountHeightM: 0 }]
    expect(describeShaftsOnFloor(hubs, ['T1'], shafts, 1)).toBeNull()
    expect(describeShaftsOnFloor(hubs, ['T1'], shafts, undefined)).toBeNull()
  })
})

function device(id: string, modelId = 'unknown-model'): PlacedFireAlarmDevice {
  return { id, modelId, x: 0, y: 0 }
}

/** Minimal `ExportPlanPngOptions` for `buildExportLegends` - only the fields that function reads matter; the rest are structurally irrelevant placeholders. */
function baseOptions(overrides: Partial<ExportPlanPngOptions> = {}): ExportPlanPngOptions {
  return {
    decodedImage: {} as HTMLImageElement,
    image: { dataUrl: '', widthPx: 1000, heightPx: 800, fileName: 'f.png' },
    cameras: [],
    walls: [],
    sensors: [],
    fireAlarmDevices: [],
    fireAlarmSettings: DEFAULT_FIRE_ALARM_SETTINGS,
    scale: null,
    cableEstimate: EMPTY_CABLE_LAYOUT_ESTIMATE,
    rows: [],
    fireAlarmWarnings: [],
    hubs: [],
    cables: [],
    cableTypes: createDefaultCableTypes(),
    cableSettings: DEFAULT_CABLE_SETTINGS,
    shaftIds: [],
    shafts: [],
    viewConfig: DEFAULT_VIEW_CONFIG,
    ...overrides,
  }
}

describe('buildExportLegends - C1 review fix: a floor\'s strip never shows another floor\'s device', () => {
  it('hub on F1 + unlisted smoke on F2: F1 strip has no compatibility line, F2 strip names the smoke by its OWN per-floor label', () => {
    const smokeOnF2 = device('smoke-f2', 'smoke-model')
    // Global warnings (as `checkFireAlarmCompatibility` run once over BOTH floors would produce):
    // the hub is a controller (never warned itself); the smoke on F2 is not listed for it.
    const projectWideWarnings: CompatibilityWarning[] = [{ code: 'not-listed-for-placed-controllers', deviceId: 'smoke-f2', modelId: 'smoke-model' }]

    const f1Legends = buildExportLegends(baseOptions({ fireAlarmDevices: [device('hub-f1', 'hub-model')] }), projectWideWarnings, {}, 16)
    expect(f1Legends.compatibilityWarningText).toBeNull()

    const f2Legends = buildExportLegends(baseOptions({ fireAlarmDevices: [smokeOnF2] }), projectWideWarnings, {}, 16)
    expect(f2Legends.compatibilityWarningText).toBe('Compatibility: 1 device(s) not listed for a placed panel/hub: ?1')
  })

  it('no controller anywhere + F1 has only a camera (no fire-alarm device): F1 strip has no fire legend line and no compatibility line', () => {
    // Global warning naming a peripheral on some OTHER floor (F1 itself places no fire-alarm device at all).
    const projectWideWarnings: CompatibilityWarning[] = [{ code: 'no-controller-placed', deviceIds: ['peripheral-on-f2'] }]

    const f1Legends = buildExportLegends(baseOptions({ cameras: [], fireAlarmDevices: [] }), projectWideWarnings, {}, 16)
    expect(f1Legends.fireAlarmLegend).toBeNull()
    expect(f1Legends.compatibilityWarningText).toBeNull()
  })
})

describe('buildExportLegends - test gap: pure strip-text builder for a multi-floor floor', () => {
  it('produces wrapped floor-note/shafts lines, the rounding note on the cable legend, and a compatibility line naming only THIS floor\'s own device', () => {
    const options = baseOptions({
      fireAlarmDevices: [device('smoke-f2', 'does-not-exist')],
      floorPosition: { index: 1, count: 3, name: 'Level 2' },
    })
    // Cross-floor fact: another floor's device is not listed anywhere - must NOT appear on this floor's strip.
    const projectWideWarnings: CompatibilityWarning[] = [{ code: 'not-listed-for-placed-controllers', deviceId: 'smoke-on-f1', modelId: 'does-not-exist' }]

    const legends = buildExportLegends(options, projectWideWarnings, {}, 16)
    expect(legends.floorNoteLines).toEqual(['F2 of 3 - Level 2'])
    expect(legends.shaftsOnFloorLines).toEqual([])
    expect(legends.compatibilityWarningText).toBeNull() // the warned device is NOT on this floor
  })
})
