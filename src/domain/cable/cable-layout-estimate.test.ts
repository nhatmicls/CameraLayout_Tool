import { describe, expect, it } from 'vitest'
import { computeCableLayoutEstimate } from './cable-layout-estimate'
import type { Cable } from './cable-layout-types'
import { CABLE_A, CABLE_B, workedExampleInput } from './cable-worked-example.test-fixtures'

describe('computeCableLayoutEstimate - worked example', () => {
  const estimate = computeCableLayoutEstimate(workedExampleInput(8000))

  it('totals both Cat6 cables into one row', () => {
    expect(estimate.hasScale).toBe(true)
    expect(estimate.totals).toHaveLength(1)
    const [total] = estimate.totals
    expect(total.type.id).toBe('cat6-utp')
    expect(total.cableCount).toBe(2)
    expect(total.labels).toEqual(['C1-H1', 'C2-H1'])
    expect(total.purchase.nominal).toBeCloseTo(30.848239, 4)
    expect(total.run.nominal).toBeCloseTo(26.824555, 4)
    expect(total.purchaseWholeM).toBe(31)
    expect(total.lineTotalVnd).toBe(248000)
  })

  it('sums the per-cable min/max exactly (one shared scale factor)', () => {
    const [total] = estimate.totals
    const [a, b] = estimate.cables
    expect(total.purchase.min).toBeCloseTo((a.purchase.min ?? 0) + (b.purchase.min ?? 0), 9)
    expect(total.purchase.max).toBeCloseTo((a.purchase.max ?? 0) + (b.purchase.max ?? 0), 9)
    expect(estimate.grandPurchase).toEqual(total.purchase)
  })

  it('reports the grand total and no warnings', () => {
    expect(estimate.grandTotalVnd).toBe(248000)
    expect(estimate.unpricedTypeCount).toBe(0)
    expect(estimate.warnings).toEqual([])
    expect(estimate.byCableId.get('cable-a')?.label).toBe('C1-H1')
  })

  it('leaves an unpriced type out of the total', () => {
    const unpriced = computeCableLayoutEstimate(workedExampleInput(null))
    expect(unpriced.totals[0].lineTotalVnd).toBeNull()
    expect(unpriced.grandTotalVnd).toBe(0)
    expect(unpriced.unpricedTypeCount).toBe(1)
  })

  it('lists totals in cableTypes order and only for types with a cable', () => {
    const input = workedExampleInput()
    const mixed = computeCableLayoutEstimate({ ...input, cables: [{ ...CABLE_A, typeId: 'alarm-signal' }, CABLE_B] })
    expect(mixed.totals.map((total) => total.type.id)).toEqual(['cat6-utp', 'alarm-signal'])
  })
})

describe('computeCableLayoutEstimate - rounding', () => {
  it('does not round a purchase of exactly 18 m up to 19', () => {
    // Horizontal 1000 px = 10 m, fixed 5 m (unmounted camera default 3, hub 1.5, slack 3.5) => run 15; waste 20% => 18.
    const input = workedExampleInput()
    const cable: Cable = { ...CABLE_B, points: [{ x: 100, y: 200 }, { x: 700, y: 200 }] }
    const estimate = computeCableLayoutEstimate({ ...input, cables: [cable], cableSettings: { ...input.cableSettings, wastePercent: 20 } })
    expect(estimate.cables[0].horizPx).toBeCloseTo(1000, 6)
    expect(estimate.totals[0].purchase.nominal).toBeCloseTo(18, 9)
    expect(estimate.totals[0].purchaseWholeM).toBe(18)
  })
})

describe('computeCableLayoutEstimate - warnings and edges', () => {
  it('has no metres and one warning without a scale', () => {
    const estimate = computeCableLayoutEstimate({ ...workedExampleInput(), scale: null })
    expect(estimate).toMatchObject({ hasScale: false, uncertainty: null, cables: [], totals: [], grandPurchase: null, grandTotalVnd: 0 })
    expect(estimate.warnings.map((warning) => warning.code)).toEqual(['scale-not-set'])
  })

  it('has no warning without a scale when there are no cables either', () => {
    expect(computeCableLayoutEstimate({ ...workedExampleInput(), scale: null, cables: [] }).warnings).toEqual([])
  })

  it('warns once when the reference line is shorter than the click error spread', () => {
    const input = workedExampleInput()
    const estimate = computeCableLayoutEstimate({
      ...input,
      scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 5, y2: 0 }, refLengthM: 0.05 },
    })
    expect(estimate.warnings.map((warning) => warning.code)).toEqual(['ref-line-too-short'])
    expect(estimate.grandPurchase).toMatchObject({ min: null, max: null })
    expect(estimate.totals[0].purchaseWholeM).toBe(31)
  })

  it('warns when the scale error is above 5%', () => {
    const input = workedExampleInput()
    const estimate = computeCableLayoutEstimate({
      ...input,
      scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 1 },
    })
    expect(estimate.warnings).toEqual([
      { code: 'scale-uncertain', message: 'Reference line too short for a reliable estimate (scale error up to 6.0%).' },
    ])
  })

  it('warns per over-length and possibly over-length cable', () => {
    const input = workedExampleInput()
    const over: Cable = { ...CABLE_B, id: 'over', points: [{ x: 100, y: 4500 }] } // 4200 + hypot(600, 4000) px
    const limit10 = input.cableTypes.map((type) => (type.id === 'cat6-utp' ? { ...type, lengthLimitM: 15.6 } : type))
    const estimate = computeCableLayoutEstimate({ ...input, cables: [CABLE_A, over], cableTypes: limit10 })
    expect(estimate.warnings).toEqual([
      { code: 'cable-maybe-over-limit', cableId: 'cable-a', message: 'C1-H1 (Cat6 UTP): may exceed the 15.6 m limit (up to 15.7 m).' },
      { code: 'cable-over-limit', cableId: 'over', message: 'C2-H1 (Cat6 UTP): 87.4 m run exceeds the 15.6 m limit.' },
    ])
  })

  it('skips a dangling cable and a cable of an unknown type', () => {
    const input = workedExampleInput()
    const estimate = computeCableLayoutEstimate({
      ...input,
      cables: [{ ...CABLE_A, hubId: 'gone' }, { ...CABLE_B, typeId: 'gone' }],
    })
    expect(estimate.cables).toEqual([])
    expect(estimate.totals).toEqual([])
    expect(estimate.grandPurchase).toBeNull()
  })
})
