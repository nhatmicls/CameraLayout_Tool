import { describe, expect, it } from 'vitest'
import type { FireAlarmModelSpec, FireAlarmSettings } from './fire-alarm-device-types'
import { equalAreaCircleRadiusM, resolveFireDetectorCoverage } from './fire-detector-coverage-resolver'

function spec(kind: FireAlarmModelSpec['kind']): FireAlarmModelSpec {
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

const datasheetMode: FireAlarmSettings = { coverageMode: 'datasheet', ceilingHeightM: 3 }
const tcvnMode = (ceilingHeightM: number | null): FireAlarmSettings => ({ coverageMode: 'tcvn-5738', ceilingHeightM })

describe('equalAreaCircleRadiusM', () => {
  it('is r = sqrt(A / pi)', () => {
    expect(equalAreaCircleRadiusM(Math.PI)).toBeCloseTo(1, 10)
  })
})

describe('resolveFireDetectorCoverage', () => {
  it('is null for a non-detector kind in either mode', () => {
    expect(resolveFireDetectorCoverage(spec('control-panel'), datasheetMode)).toBeNull()
    expect(resolveFireDetectorCoverage(spec('control-panel'), tcvnMode(3))).toBeNull()
    expect(resolveFireDetectorCoverage(spec('sounder'), tcvnMode(3))).toBeNull()
  })

  it('is null for every detector in datasheet mode (no shipped datasheet prints a protection value)', () => {
    expect(resolveFireDetectorCoverage(spec('smoke-detector'), datasheetMode)).toBeNull()
    expect(resolveFireDetectorCoverage(spec('heat-detector'), datasheetMode)).toBeNull()
    expect(resolveFireDetectorCoverage(spec('co-detector'), datasheetMode)).toBeNull()
  })

  it('is null in tcvn mode when no ceiling height is set', () => {
    expect(resolveFireDetectorCoverage(spec('smoke-detector'), tcvnMode(null))).toBeNull()
  })

  it('is null for co-detector in tcvn mode (no printed table at any height)', () => {
    expect(resolveFireDetectorCoverage(spec('co-detector'), tcvnMode(3))).toBeNull()
  })

  it('is null above the table (tested via a height beyond the last band)', () => {
    expect(resolveFireDetectorCoverage(spec('smoke-detector'), tcvnMode(12.5))).toBeNull()
    expect(resolveFireDetectorCoverage(spec('heat-detector'), tcvnMode(9.5))).toBeNull()
  })

  it('resolves the smoke row at a mid-band height to the equal-area radius plus display fields', () => {
    const resolved = resolveFireDetectorCoverage(spec('smoke-detector'), tcvnMode(5))
    expect(resolved).not.toBeNull()
    expect(resolved?.basis).toBe('tcvn-5738')
    expect(resolved?.areaM2).toBe(70)
    expect(resolved?.spacingM).toBe(8.5)
    expect(resolved?.wallDistanceM).toBe(4.0)
    expect(resolved?.radiusM).toBeCloseTo(equalAreaCircleRadiusM(70), 10)
  })

  it('resolves the heat row exactly on a band edge', () => {
    const resolved = resolveFireDetectorCoverage(spec('heat-detector'), tcvnMode(3.5))
    expect(resolved?.areaM2).toBe(25)
  })
})
