import { describe, expect, it } from 'vitest'
import type { BomRow } from './bill-of-materials-grouping'
import { mergeBomRowsAcrossFloors, type FloorBomRows } from './merge-bom-rows-across-floors'

function cameraRow(labels: string, quantity: number, lineTotalVnd: number | null = 1000): BomRow {
  return {
    type: 'Camera',
    brand: 'Hikvision',
    model: 'DS-2CD2T47G2-L',
    formFactor: 'bullet',
    resolution: '2688x1520 (4 MP)',
    lens: '2.8 mm',
    quantity,
    unit: 'pcs',
    labels,
    unitPriceVnd: lineTotalVnd === null ? null : 1000 / quantity,
    lineTotalVnd,
  }
}

function fireRow(labels: string, quantity: number, notes = ''): BomRow {
  return {
    type: 'Smoke detector',
    brand: 'Hikvision',
    model: 'DS-PDSMK-S-WE',
    formFactor: '',
    resolution: '',
    lens: '',
    quantity,
    unit: 'pcs',
    labels,
    unitPriceVnd: null,
    lineTotalVnd: null,
    notes,
  }
}

describe('mergeBomRowsAcrossFloors', () => {
  it('a single floor\'s rows pass through with that floor\'s own prefix applied to the labels', () => {
    const rows = [cameraRow('C1', 1)]
    expect(mergeBomRowsAcrossFloors([{ prefix: 'F1_', rows }])).toEqual([{ ...rows[0], labels: 'F1_C1' }])
  })

  it('an empty prefix (defensive) is a no-op on the labels', () => {
    const rows = [cameraRow('C1', 1)]
    expect(mergeBomRowsAcrossFloors([{ prefix: '', rows }])).toEqual(rows)
  })

  it('merges the same model across two floors: quantity and line total summed, labels concatenated with each floor\'s own prefix', () => {
    const perFloor: FloorBomRows[] = [
      { prefix: 'F1_', rows: [cameraRow('C1', 1, 1000)] },
      { prefix: 'F2_', rows: [cameraRow('C1, C3', 2, 2000)] },
    ]
    const merged = mergeBomRowsAcrossFloors(perFloor)
    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(3)
    expect(merged[0].labels).toBe('F1_C1, F2_C1, F2_C3')
    expect(merged[0].lineTotalVnd).toBe(3000)
  })

  it('keeps an unpriced row unpriced when merged with another unpriced row', () => {
    const perFloor: FloorBomRows[] = [
      { prefix: 'F1_', rows: [cameraRow('C1', 1, null)] },
      { prefix: 'F2_', rows: [cameraRow('C1', 1, null)] },
    ]
    expect(mergeBomRowsAcrossFloors(perFloor)[0].lineTotalVnd).toBeNull()
  })

  it('a row with no notes key (camera/sensor) never gains one after merging', () => {
    const perFloor: FloorBomRows[] = [
      { prefix: 'F1_', rows: [cameraRow('C1', 1)] },
      { prefix: 'F2_', rows: [cameraRow('C1', 1)] },
    ]
    expect(mergedHasNoNotesKey(mergeBomRowsAcrossFloors(perFloor)[0])).toBe(true)
  })

  it('prefixes the device labels inside a fire-alarm "not listed" note and combines them across floors', () => {
    const perFloor: FloorBomRows[] = [
      { prefix: 'F1_', rows: [fireRow('F3', 1, 'Not listed for a placed panel/hub: F3')] },
      { prefix: 'F2_', rows: [fireRow('F5', 1, 'Not listed for a placed panel/hub: F5')] },
    ]
    const merged = mergeBomRowsAcrossFloors(perFloor)
    expect(merged[0].notes).toBe('Not listed for a placed panel/hub: F1_F3, F2_F5')
  })

  it('keeps "No panel/hub placed" as-is when both floors already agree (global compatibility fact)', () => {
    const perFloor: FloorBomRows[] = [
      { prefix: 'F1_', rows: [fireRow('F1', 1, 'No panel/hub placed')] },
      { prefix: 'F2_', rows: [fireRow('F1', 1, 'No panel/hub placed')] },
    ]
    expect(mergeBomRowsAcrossFloors(perFloor)[0].notes).toBe('No panel/hub placed')
  })

  it('a different lens (different mergeKey) stays a separate row', () => {
    const perFloor: FloorBomRows[] = [
      { prefix: 'F1_', rows: [cameraRow('C1', 1)] },
      { prefix: 'F2_', rows: [{ ...cameraRow('C1', 1), lens: '2.8-12 mm' }] },
    ]
    expect(mergeBomRowsAcrossFloors(perFloor)).toHaveLength(2)
  })
})

function mergedHasNoNotesKey(row: BomRow): boolean {
  return !('notes' in row)
}
