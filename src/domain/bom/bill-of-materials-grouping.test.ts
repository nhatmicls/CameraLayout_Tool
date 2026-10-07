import { describe, expect, it } from 'vitest'
import { bomToCsvTable, bomToTable, computeBomTotal, formatVnd, groupCamerasIntoBom } from './bill-of-materials-grouping'
import type { CameraModelSpec, PlacedCamera } from '../project-file/project-types'

const domeFixed: CameraModelSpec = {
  brand: 'hikvision',
  model: 'DS-2CD2143G2-I',
  formFactor: 'dome',
  pixelWidth: 2688,
  pixelHeight: 1520,
  resolutionMp: 4,
  lens: { kind: 'fixed', focalMm: 2.8, hfovDeg: 111 },
  illuminationRangeM: 30,
  priceVn: { amountVnd: 2_500_000 },
}

const domeFixedOtherLens: CameraModelSpec = {
  ...domeFixed,
  lens: { kind: 'fixed', focalMm: 4, hfovDeg: 84 },
}

const bulletVarifocal: CameraModelSpec = {
  brand: 'axis',
  model: 'P1465-LE',
  formFactor: 'bullet',
  pixelWidth: 1920,
  pixelHeight: 1080,
  resolutionMp: 2,
  lens: { kind: 'varifocal', focalMinMm: 2.8, focalMaxMm: 12, hfovWideDeg: 100, hfovTeleDeg: 30 },
  illuminationRangeM: null,
}

const modelById: Record<string, CameraModelSpec> = {
  'hik-dome-2.8': domeFixed,
  'hik-dome-4': domeFixedOtherLens,
  'axis-bullet': bulletVarifocal,
}

function camera(modelId: string): PlacedCamera {
  return { id: `cam-${modelId}`, modelId, x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

describe('groupCamerasIntoBom', () => {
  it('groups same model+lens into one row with a quantity and camera list', () => {
    const cameras = [camera('hik-dome-2.8'), camera('hik-dome-2.8')]
    const rows = groupCamerasIntoBom(cameras, modelById)
    expect(rows).toHaveLength(1)
    expect(rows[0].quantity).toBe(2)
    expect(rows[0].labels).toBe('C1, C2')
    expect(rows[0].lens).toBe('2.8 mm')
  })

  it('treats the same printed model with a different lens as a separate row', () => {
    const cameras = [camera('hik-dome-2.8'), camera('hik-dome-4')]
    const rows = groupCamerasIntoBom(cameras, modelById)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.lens).sort()).toEqual(['2.8 mm', '4 mm'])
  })

  it('formats fixed and varifocal lens labels correctly', () => {
    const rows = groupCamerasIntoBom([camera('axis-bullet')], modelById)
    expect(rows[0].lens).toBe('2.8-12 mm')
    expect(rows[0].resolution).toBe('1920x1080 (2 MP)')
  })

  it('sorts rows by brand then model', () => {
    const cameras = [camera('axis-bullet'), camera('hik-dome-2.8')]
    const rows = groupCamerasIntoBom(cameras, modelById)
    expect(rows.map((r) => r.brand)).toEqual(['axis', 'hikvision'])
  })

  it('derives camera numbers from placement order, skipping cameras with unknown models', () => {
    const cameras = [camera('unknown-model'), camera('hik-dome-2.8'), camera('unknown-model'), camera('hik-dome-2.8')]
    const rows = groupCamerasIntoBom(cameras, modelById)
    expect(rows).toHaveLength(1)
    // Indices 2 and 4 (1-based) survive; the unknown-model slots keep their position numbering.
    expect(rows[0].labels).toBe('C2, C4')
  })

  it('returns an empty array for no cameras', () => {
    expect(groupCamerasIntoBom([], modelById)).toEqual([])
  })
})

describe('bomToTable', () => {
  it('returns header-only table for an empty BOM', () => {
    const table = bomToTable([])
    expect(table).toHaveLength(1)
    expect(table[0]).toEqual([
      'Type',
      'Brand',
      'Model',
      'Form Factor',
      'Resolution',
      'Lens',
      'Quantity',
      'Unit',
      'Labels',
      'Unit Price (VND)',
      'Total (VND)',
    ])
  })

  it('includes a leading Type column and the Unit + Labels columns after Quantity, matching the header', () => {
    const rows = groupCamerasIntoBom([camera('hik-dome-2.8'), camera('hik-dome-2.8')], modelById)
    const table = bomToTable(rows)
    expect(table[0][0]).toBe('Type')
    expect(table[1][0]).toBe('Camera')
    expect(table[0]).toHaveLength(11)
    expect(table[0][7]).toBe('Unit')
    expect(table[1][7]).toBe('pcs')
    expect(table[0][8]).toBe('Labels')
    expect(table[1][8]).toBe('C1, C2')
    expect(table[1][6]).toBe('2') // Quantity
  })

  it('appends unit price and line total as plain integers, blank when the model has no price', () => {
    const rows = groupCamerasIntoBom([camera('axis-bullet'), camera('hik-dome-2.8'), camera('hik-dome-2.8')], modelById)
    const table = bomToTable(rows)
    expect(table[1].slice(9)).toEqual(['', '']) // axis: no price
    expect(table[2].slice(9)).toEqual(['2500000', '5000000'])
  })

  it('uses the supplied price formatter', () => {
    const rows = groupCamerasIntoBom([camera('hik-dome-2.8')], modelById)
    expect(bomToTable(rows, () => 'X')[1].slice(9)).toEqual(['X', 'X'])
  })
})

describe('bomToCsvTable', () => {
  it('appends a trailing Notes column to the PNG table header', () => {
    const header = bomToCsvTable([])[0]
    expect(header).toEqual([...bomToTable([])[0], 'Notes'])
    expect(header).toHaveLength(12)
  })

  it('leaves Notes empty for a row with no notes set', () => {
    const rows = groupCamerasIntoBom([camera('hik-dome-2.8')], modelById)
    const table = bomToCsvTable(rows)
    expect(table[1]).toHaveLength(12)
    expect(table[1][11]).toBe('')
  })

  it('writes a row-supplied notes string into the 12th column', () => {
    const rows = groupCamerasIntoBom([camera('hik-dome-2.8')], modelById)
    rows[0].notes = 'Not listed for a placed panel/hub: F3, F7'
    const table = bomToCsvTable(rows)
    expect(table[1][11]).toBe('Not listed for a placed panel/hub: F3, F7')
  })

  it('does not add a Notes column to the PNG table (bomToTable stays 11 columns)', () => {
    const rows = groupCamerasIntoBom([camera('hik-dome-2.8')], modelById)
    rows[0].notes = 'should never reach the PNG table'
    expect(bomToTable(rows)[1]).toHaveLength(11)
  })
})

describe('computeBomTotal', () => {
  it('sums priced rows and counts cameras left out for lack of a price', () => {
    const rows = groupCamerasIntoBom(
      [camera('hik-dome-2.8'), camera('hik-dome-4'), camera('axis-bullet'), camera('axis-bullet')],
      modelById,
    )
    expect(computeBomTotal(rows)).toEqual({ totalVnd: 5_000_000, unpricedQuantity: 2, unpricedCableTypeCount: 0 })
  })

  it('is zero for an empty BOM', () => {
    expect(computeBomTotal([])).toEqual({ totalVnd: 0, unpricedQuantity: 0, unpricedCableTypeCount: 0 })
  })
})

describe('formatVnd', () => {
  it('groups thousands vi-VN style with a dong sign', () => {
    expect(formatVnd(1250000)).toBe('1.250.000 ₫')
  })
})
