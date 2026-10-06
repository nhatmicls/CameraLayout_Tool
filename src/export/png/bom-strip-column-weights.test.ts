import { describe, expect, it } from 'vitest'
import { bomToTable } from '../../domain/bom/bill-of-materials-grouping'
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

  it('is 1 for a plan with no sensors and no cables (strip height unchanged)', () => {
    expect(legendLineCountFor({ sensorKindsPresent: [], cableLegend: null })).toBe(1)
  })

  it('adds a line for sensors and a line for cables', () => {
    expect(legendLineCountFor({ sensorKindsPresent: ['pir'], cableLegend: null })).toBe(2)
    expect(legendLineCountFor({ sensorKindsPresent: [], cableLegend })).toBe(2)
    expect(legendLineCountFor({ sensorKindsPresent: ['pir', 'beam'], cableLegend })).toBe(3)
  })
})
