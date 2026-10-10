import { describe, expect, it } from 'vitest'
import type { Hub } from '../cable/cable-layout-types'
import { compareCablingPointBomRows, groupCablingPointsIntoBom } from './cabling-point-bill-of-materials-grouping'

function hub(id: string, kind?: Hub['kind']): Hub {
  return { id, kind, x: 0, y: 0, mountHeightM: 1.5 }
}

describe('groupCablingPointsIntoBom', () => {
  it('returns no rows for no hubs', () => {
    expect(groupCablingPointsIntoBom([], [])).toEqual([])
  })

  it('one row per kind present, fixed order (Cable hub, Riser, Drop, Shaft opening), quantities and labels from the allocator', () => {
    const hubs: Hub[] = [hub('h1'), hub('h2'), hub('r1', 'riser'), hub('d1', 'drop'), hub('t1', 'shaft'), hub('t2', 'shaft'), hub('t3', 'shaft')]
    const labels = ['H1', 'H2', 'R1', 'D1', 'T1', 'T2', 'T3']
    const rows = groupCablingPointsIntoBom(hubs, labels)

    expect(rows.map((r) => r.type)).toEqual(['Cable hub', 'Riser', 'Drop', 'Shaft opening'])
    expect(rows.map((r) => r.quantity)).toEqual([2, 1, 1, 3])
    expect(rows.map((r) => r.labels)).toEqual(['H1, H2', 'R1', 'D1', 'T1, T2, T3'])
  })

  it('every row is unit pcs, has no brand/model/resolution/lens and prices TBD', () => {
    const rows = groupCablingPointsIntoBom([hub('h1')], ['H1'])
    expect(rows).toEqual([
      {
        type: 'Cable hub',
        brand: '',
        model: '',
        formFactor: '',
        resolution: '',
        lens: '',
        quantity: 1,
        unit: 'pcs',
        labels: 'H1',
        unitPriceVnd: null,
        lineTotalVnd: null,
        priceTbd: true,
      },
    ])
  })

  it('only produces a row for kinds that are actually present', () => {
    const rows = groupCablingPointsIntoBom([hub('r1', 'riser')], ['R1'])
    expect(rows.map((r) => r.type)).toEqual(['Riser'])
  })

  it('an undefined hub.kind counts as a plain "Cable hub"', () => {
    const rows = groupCablingPointsIntoBom([hub('h1', undefined)], ['H1'])
    expect(rows[0].type).toBe('Cable hub')
  })
})

describe('compareCablingPointBomRows', () => {
  it('sorts by the fixed kind order, never alphabetically', () => {
    const rows = groupCablingPointsIntoBom(
      [hub('t1', 'shaft'), hub('d1', 'drop'), hub('r1', 'riser'), hub('h1')],
      ['T1', 'D1', 'R1', 'H1'],
    )
    // Already in fixed order from the grouper; re-sorting with a shuffled copy must restore it.
    const shuffled = [rows[3], rows[1], rows[2], rows[0]]
    shuffled.sort(compareCablingPointBomRows)
    expect(shuffled.map((r) => r.type)).toEqual(['Cable hub', 'Riser', 'Drop', 'Shaft opening'])
  })
})
