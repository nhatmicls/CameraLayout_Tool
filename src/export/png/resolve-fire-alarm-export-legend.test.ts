import { describe, expect, it } from 'vitest'
import { resolveCompatibilityWarningText, resolveFireAlarmLegend } from './resolve-fire-alarm-export-legend'
import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { DEFAULT_FIRE_ALARM_SETTINGS, type FireAlarmModelSpec, type FireAlarmSettings, type PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'

const smokeDetector: FireAlarmModelSpec = {
  id: 'hik-smoke',
  brand: 'hikvision',
  model: 'DS-PDSMK-S-WE',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  sourceUrl: 'https://example.test',
  sourceRetrieved: '2026-10-07',
  priceVn: null,
  kind: 'smoke-detector',
}

const wirelessHub: FireAlarmModelSpec = {
  id: 'hik-hub',
  brand: 'hikvision',
  model: 'DS-PWA96-M-WE',
  productLine: 'ax-pro',
  worksStandalone: false,
  certificationsAsPrinted: [],
  sourceUrl: 'https://example.test',
  sourceRetrieved: '2026-10-07',
  priceVn: null,
  kind: 'wireless-hub',
  capacityAsPrinted: [],
  compatibleDevices: [],
}

const modelById: Record<string, FireAlarmModelSpec> = { 'hik-smoke': smokeDetector, 'hik-hub': wirelessHub }

function device(id: string, modelId: string): PlacedFireAlarmDevice {
  return { id, modelId, x: 0, y: 0 }
}

const tcvnSettings: FireAlarmSettings = { coverageMode: 'tcvn-5738', ceilingHeightM: 3.2 }

describe('resolveFireAlarmLegend', () => {
  it('is null when no placed device has a known model', () => {
    expect(resolveFireAlarmLegend([device('d1', 'unknown')], modelById, DEFAULT_FIRE_ALARM_SETTINGS, true)).toBeNull()
  })

  it('counts kinds in display order, wireless-hub before smoke-detector', () => {
    const legend = resolveFireAlarmLegend(
      [device('d1', 'hik-smoke'), device('d2', 'hik-hub'), device('d3', 'hik-smoke')],
      modelById,
      DEFAULT_FIRE_ALARM_SETTINGS,
      true,
    )
    expect(legend?.kindCounts).toEqual([
      { kind: 'wireless-hub', count: 1 },
      { kind: 'smoke-detector', count: 2 },
    ])
  })

  it('has no coverage basis text in datasheet mode (no circle is ever drawn)', () => {
    const legend = resolveFireAlarmLegend([device('d1', 'hik-smoke')], modelById, DEFAULT_FIRE_ALARM_SETTINGS, true)
    expect(legend?.coverageBasisText).toBeNull()
  })

  it('has no coverage basis text without a scale, even in tcvn-5738 mode with a ceiling height', () => {
    const legend = resolveFireAlarmLegend([device('d1', 'hik-smoke')], modelById, tcvnSettings, false)
    expect(legend?.coverageBasisText).toBeNull()
  })

  it('states the TCVN edition and ceiling height once a circle is actually drawn', () => {
    const legend = resolveFireAlarmLegend([device('d1', 'hik-smoke')], modelById, tcvnSettings, true)
    expect(legend?.coverageBasisText).toBe('coverage: TCVN 5738:2021 at h = 3.2 m, equal-area circle, approximation')
  })

  it('has no coverage basis text when every device is a non-detector kind (a hub has no circle)', () => {
    const legend = resolveFireAlarmLegend([device('d1', 'hik-hub')], modelById, tcvnSettings, true)
    expect(legend?.coverageBasisText).toBeNull()
  })
})

describe('resolveCompatibilityWarningText', () => {
  const devices = [device('d1', 'hik-hub'), device('d2', 'hik-smoke'), device('d3', 'hik-smoke'), device('d4', 'hik-smoke'), device('d5', 'hik-smoke')]

  it('is null with no warnings', () => {
    expect(resolveCompatibilityWarningText(devices, [])).toBeNull()
  })

  it('formats the no-controller-placed aggregated line with F-labels', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'no-controller-placed', deviceIds: ['d2', 'd3'] }]
    expect(resolveCompatibilityWarningText(devices, warnings)).toBe('No panel/hub placed for: F2, F3')
  })

  it('formats the not-listed line with a count and the first two labels', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'not-listed-for-placed-controllers', deviceId: 'd2', modelId: 'hik-smoke' }]
    expect(resolveCompatibilityWarningText(devices, warnings)).toBe('Compatibility: 1 device(s) not listed for a placed panel/hub: F2')
  })

  it('C1 fix: never falls back to a raw device id - drops a warning naming a device not in `devices`', () => {
    // Simulates what used to leak through before the caller pre-filtered: a warning for a device
    // that belongs to ANOTHER floor (not in this floor's own `devices` list).
    const warnings: CompatibilityWarning[] = [{ code: 'not-listed-for-placed-controllers', deviceId: 'device-on-another-floor', modelId: 'hik-smoke' }]
    expect(resolveCompatibilityWarningText(devices, warnings)).toBeNull()
  })

  it('C1 fix: a no-controller-placed warning drops the ids not in `devices`, keeping the rest', () => {
    const warnings: CompatibilityWarning[] = [{ code: 'no-controller-placed', deviceIds: ['d2', 'device-on-another-floor'] }]
    expect(resolveCompatibilityWarningText(devices, warnings)).toBe('No panel/hub placed for: F2')
  })

  it('truncates the label list to "+N more" past two labels', () => {
    const warnings: CompatibilityWarning[] = [
      { code: 'not-listed-for-placed-controllers', deviceId: 'd2', modelId: 'hik-smoke' },
      { code: 'not-listed-for-placed-controllers', deviceId: 'd3', modelId: 'hik-smoke' },
      { code: 'not-listed-for-placed-controllers', deviceId: 'd4', modelId: 'hik-smoke' },
      { code: 'not-listed-for-placed-controllers', deviceId: 'd5', modelId: 'hik-smoke' },
    ]
    expect(resolveCompatibilityWarningText(devices, warnings)).toBe(
      'Compatibility: 4 device(s) not listed for a placed panel/hub: F2, F3 +2 more',
    )
  })
})
