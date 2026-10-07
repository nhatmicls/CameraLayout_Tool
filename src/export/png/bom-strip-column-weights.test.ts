import { describe, expect, it } from 'vitest'
import { bomToTable } from '../../domain/bom/bill-of-materials-grouping'
import type { SensorKind } from '../../domain/sensor/sensor-types'
import { COLUMN_WEIGHTS, legendLineCountFor } from './draw-bom-table-and-legend-strip'

describe('PNG strip column weights', () => {
  it('has one weight per BOM table column', () => {
    expect(COLUMN_WEIGHTS).toHaveLength(bomToTable([])[0].length)
  })

  it('sums to 1, so the table spans the strip exactly', () => {
    expect(COLUMN_WEIGHTS.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 9)
  })

  it('keeps the two hand-tuned header widths (Quantity, Unit Price)', () => {
    const header = bomToTable([])[0]
    expect(COLUMN_WEIGHTS[header.indexOf('Quantity')]).toBe(0.07)
    expect(COLUMN_WEIGHTS[header.indexOf('Unit Price (VND)')]).toBe(0.13)
  })
})

describe('legendLineCountFor', () => {
  const cableLegend = { types: [], hasDashedCable: false, noteText: '' }
  const fireAlarmLegend = { kindCounts: [{ kind: 'smoke-detector' as const, count: 1 }], coverageBasisText: null }
  const base = {
    sensorKindsPresent: [] as SensorKind[],
    cableLegend: null,
    fireAlarmLegend: null,
    compatibilityWarningText: null,
    viewFilterNoteLines: [] as string[],
  }

  it('is 1 for a plan with no sensors, cables or fire-alarm devices (strip height unchanged)', () => {
    expect(legendLineCountFor(base)).toBe(1)
  })

  it('adds a line for sensors, cables, fire-alarm devices and a compatibility warning', () => {
    expect(legendLineCountFor({ ...base, sensorKindsPresent: ['pir'] })).toBe(2)
    expect(legendLineCountFor({ ...base, cableLegend })).toBe(2)
    expect(legendLineCountFor({ ...base, fireAlarmLegend })).toBe(2)
    expect(legendLineCountFor({ ...base, compatibilityWarningText: 'Compatibility: 1 device(s) not listed for a placed panel/hub: F1' })).toBe(2)
    expect(legendLineCountFor({ ...base, sensorKindsPresent: ['pir', 'beam'], cableLegend, fireAlarmLegend, compatibilityWarningText: 'x' })).toBe(5)
  })

  it('adds one line per wrapped view-filter note line, and none when nothing is hidden', () => {
    expect(legendLineCountFor({ ...base, viewFilterNoteLines: ['Shown: walls', 'Hidden: cables,', 'hubs'] })).toBe(4)
    expect(legendLineCountFor({ ...base, sensorKindsPresent: ['pir'], viewFilterNoteLines: ['Shown: none', 'Hidden: walls'] })).toBe(4)
  })
})
