import { describe, expect, it } from 'vitest'
import { computeCableLayoutEstimate } from '../cable/cable-layout-estimate'
import { CABLE_A, workedExampleInput } from '../cable/cable-worked-example.test-fixtures'
import { serializeCsv } from '../export/csv-serializer-with-formula-guard'
import { bomToTable, computeBomTotal, type BomRow } from './bill-of-materials-grouping'
import { formatBomUnpricedNote, groupCablesIntoBom } from './cable-bill-of-materials-grouping'

describe('groupCablesIntoBom', () => {
  it('turns the worked example into one priced Cat6 row in metres', () => {
    expect(groupCablesIntoBom(computeCableLayoutEstimate(workedExampleInput(8000)))).toEqual([
      {
        type: 'Cable',
        brand: '',
        model: 'Cat6 UTP',
        formFactor: '',
        resolution: '',
        lens: '',
        quantity: 31,
        unit: 'm',
        labels: 'C1-H1, C2-H1',
        unitPriceVnd: 8000,
        lineTotalVnd: 248000,
      },
    ])
  })

  it('leaves both prices null for a type with no price', () => {
    const [row] = groupCablesIntoBom(computeCableLayoutEstimate(workedExampleInput(null)))
    expect(row).toMatchObject({ quantity: 31, unitPriceVnd: null, lineTotalVnd: null })
  })

  it('has no rows without a scale', () => {
    expect(groupCablesIntoBom(computeCableLayoutEstimate({ ...workedExampleInput(), scale: null }))).toEqual([])
  })

  it('has one row per type in use, in cable-type order, and none for an unused type', () => {
    const input = workedExampleInput()
    const rows = groupCablesIntoBom(
      computeCableLayoutEstimate({ ...input, cables: [{ ...CABLE_A, typeId: 'alarm-signal' }, ...input.cables.slice(1)] }),
    )
    expect(rows.map((row) => row.model)).toEqual(['Cat6 UTP', 'Alarm signal'])
  })

  it('writes the metres and the unit into the shared table', () => {
    const table = bomToTable(groupCablesIntoBom(computeCableLayoutEstimate(workedExampleInput(8000))))
    expect(table[1]).toEqual(['Cable', '', 'Cat6 UTP', '', '', '', '31', 'm', 'C1-H1, C2-H1', '8000', '248000'])
  })

  it('reaches the CSV with a formula-looking type name neutralised', () => {
    const input = workedExampleInput()
    const cableTypes = input.cableTypes.map((type) => (type.id === 'cat6-utp' ? { ...type, name: '=SUM(A1)' } : type))
    const csv = serializeCsv(bomToTable(groupCablesIntoBom(computeCableLayoutEstimate({ ...input, cableTypes }))))
    expect(csv).toContain("Cable,,'=SUM(A1),")
    expect(csv).not.toContain(',=SUM(A1)')
  })
})

describe('computeBomTotal with cable rows', () => {
  const camera = (lineTotalVnd: number | null, quantity: number): BomRow => ({
    type: 'Camera',
    brand: 'b',
    model: 'm',
    formFactor: 'dome',
    resolution: '',
    lens: '',
    quantity,
    unit: 'pcs',
    labels: '',
    unitPriceVnd: lineTotalVnd === null ? null : lineTotalVnd / quantity,
    lineTotalVnd,
  })
  const [pricedCable] = groupCablesIntoBom(computeCableLayoutEstimate(workedExampleInput(8000)))
  const [unpricedCable] = groupCablesIntoBom(computeCableLayoutEstimate(workedExampleInput(null)))

  it('counts unpriced pieces and unpriced cable types apart (31 m is not 31 items)', () => {
    const total = computeBomTotal([camera(null, 2), unpricedCable])
    expect(total).toEqual({ totalVnd: 0, unpricedQuantity: 2, unpricedCableTypeCount: 1 })
    expect(formatBomUnpricedNote(total)).toBe('excludes 2 items with no listed price and 1 cable type with no price')
  })

  it('adds a priced cable row to the total', () => {
    const total = computeBomTotal([camera(5_000_000, 2), pricedCable])
    expect(total).toEqual({ totalVnd: 5_248_000, unpricedQuantity: 0, unpricedCableTypeCount: 0 })
    expect(formatBomUnpricedNote(total)).toBe('')
  })

  it('words a single unpriced item or cable type in the singular', () => {
    expect(formatBomUnpricedNote({ totalVnd: 0, unpricedQuantity: 1, unpricedCableTypeCount: 0 })).toBe('excludes 1 item with no listed price')
    expect(formatBomUnpricedNote({ totalVnd: 0, unpricedQuantity: 0, unpricedCableTypeCount: 2 })).toBe('excludes 2 cable types with no price')
  })
})
