import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FIRE_ALARM_SETTINGS,
  type FireAlarmModelSpec,
  type FireAlarmSettings,
} from '../../domain/fire-alarm/fire-alarm-device-types'
import { resolveFireDetectorCoverageReadout } from './fire-detector-coverage-readout-text'

const tcvn = (ceilingHeightM: number | null): FireAlarmSettings => ({ coverageMode: 'tcvn-5738', ceilingHeightM })

/** Minimal spec satisfying `FireAlarmModelSpec` for a non-controller kind - only `kind` is read by the readout/resolver. */
function spec(kind: 'control-panel' | 'wireless-hub' | 'smoke-detector' | 'heat-detector' | 'co-detector'): FireAlarmModelSpec {
  const common = {
    id: `hikvision-${kind}`,
    brand: 'hikvision',
    model: kind.toUpperCase(),
    productLine: 'ax-pro' as const,
    worksStandalone: false,
    certificationsAsPrinted: [],
    sourceUrl: 'https://assets.hikvision.com/x.pdf',
    sourceRetrieved: '2026-10-07',
  }
  if (kind === 'control-panel' || kind === 'wireless-hub') {
    return { ...common, kind, capacityAsPrinted: [], compatibleDevices: [] }
  }
  return { ...common, kind }
}

describe('resolveFireDetectorCoverageReadout', () => {
  it('returns not-detector for a non-detector kind, in either mode', () => {
    expect(resolveFireDetectorCoverageReadout(spec('control-panel'), tcvn(3), true)).toEqual({ case: 'not-detector' })
    expect(resolveFireDetectorCoverageReadout(spec('wireless-hub'), DEFAULT_FIRE_ALARM_SETTINGS, true)).toEqual({
      case: 'not-detector',
    })
  })

  it('returns datasheet-mode for any detector kind in datasheet mode', () => {
    expect(resolveFireDetectorCoverageReadout(spec('smoke-detector'), DEFAULT_FIRE_ALARM_SETTINGS, true)).toEqual({
      case: 'datasheet-mode',
    })
  })

  it('returns needs-ceiling-height in TCVN mode with no height set', () => {
    expect(resolveFireDetectorCoverageReadout(spec('smoke-detector'), tcvn(null), true)).toEqual({ case: 'needs-ceiling-height' })
  })

  it('returns co-no-table for a CO detector in TCVN mode regardless of height', () => {
    expect(resolveFireDetectorCoverageReadout(spec('co-detector'), tcvn(2), true)).toEqual({ case: 'co-no-table' })
    expect(resolveFireDetectorCoverageReadout(spec('co-detector'), tcvn(20), true)).toEqual({ case: 'co-no-table' })
    expect(resolveFireDetectorCoverageReadout(spec('co-detector'), tcvn(null), true)).toEqual({ case: 'co-no-table' })
  })

  it('returns outside-table when the ceiling height exceeds the tallest printed band', () => {
    expect(resolveFireDetectorCoverageReadout(spec('smoke-detector'), tcvn(12.1), true)).toEqual({
      case: 'outside-table',
      kindLabel: 'Smoke detector',
    })
    expect(resolveFireDetectorCoverageReadout(spec('heat-detector'), tcvn(9.1), true)).toEqual({
      case: 'outside-table',
      kindLabel: 'Heat detector',
    })
  })

  it('returns needs-scale when a circle would resolve but no scale is set', () => {
    expect(resolveFireDetectorCoverageReadout(spec('smoke-detector'), tcvn(5), false)).toEqual({ case: 'needs-scale' })
  })

  it('returns the equal-area circle figures for a smoke detector within the table', () => {
    const readout = resolveFireDetectorCoverageReadout(spec('smoke-detector'), tcvn(5), true)
    expect(readout).toEqual({
      case: 'circle',
      edition: 'TCVN 5738:2021',
      clause: '6.13',
      table: 'Bảng 1',
      ceilingHeightM: 5,
      areaM2: 70,
      radiusM: Math.sqrt(70 / Math.PI),
      spacingM: 8.5,
      wallDistanceM: 4.0,
    })
  })

  it('returns the equal-area circle figures for a heat detector within the table', () => {
    const readout = resolveFireDetectorCoverageReadout(spec('heat-detector'), tcvn(2), true)
    expect(readout).toEqual({
      case: 'circle',
      edition: 'TCVN 5738:2021',
      clause: '6.15.1',
      table: 'Bảng 2',
      ceilingHeightM: 2,
      areaM2: 25,
      radiusM: Math.sqrt(25 / Math.PI),
      spacingM: 5.0,
      wallDistanceM: 2.5,
    })
  })

  it('is inclusive at the top of a height band (exactly 3.5 m stays in the first smoke band)', () => {
    const readout = resolveFireDetectorCoverageReadout(spec('smoke-detector'), tcvn(3.5), true)
    expect(readout).toMatchObject({ case: 'circle', areaM2: 85 })
  })
})
