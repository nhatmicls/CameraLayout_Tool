import { describe, expect, it } from 'vitest'
import { filterSensorTabItems, type SensorTabItem } from './sensor-catalog-list-filter'

const sensorItem = (id: string, brand: string, kind: string): SensorTabItem =>
  ({ source: 'sensor', model: { id, brand, kind } }) as unknown as SensorTabItem

const fireAlarmItem = (id: string, brand: string, kind: string): SensorTabItem =>
  ({ source: 'fire-alarm', model: { id, brand, kind } }) as unknown as SensorTabItem

describe('filterSensorTabItems', () => {
  const items: SensorTabItem[] = [
    sensorItem('hikvision-pir-1', 'hikvision', 'pir'),
    sensorItem('dahua-vibration-1', 'dahua', 'vibration'),
    fireAlarmItem('hikvision-magnetic-1', 'hikvision', 'magnetic-contact'),
  ]

  it('returns every item with no filter', () => {
    const result = filterSensorTabItems(items, { brand: 'all', kind: 'all', listedIds: null })
    expect(result).toHaveLength(3)
  })

  it('filters by brand across both sources', () => {
    const result = filterSensorTabItems(items, { brand: 'hikvision', kind: 'all', listedIds: null })
    expect(result.map((item) => item.model.id).sort()).toEqual(['hikvision-magnetic-1', 'hikvision-pir-1'])
  })

  it('filters by kind, whether the kind belongs to a sensor or a fire-alarm item', () => {
    expect(filterSensorTabItems(items, { brand: 'all', kind: 'pir', listedIds: null }).map((i) => i.model.id)).toEqual([
      'hikvision-pir-1',
    ])
    expect(
      filterSensorTabItems(items, { brand: 'all', kind: 'magnetic-contact', listedIds: null }).map((i) => i.model.id),
    ).toEqual(['hikvision-magnetic-1'])
  })

  it('keeps only ids in listedIds when given (the "works with" controller filter)', () => {
    const result = filterSensorTabItems(items, { brand: 'all', kind: 'all', listedIds: new Set(['dahua-vibration-1']) })
    expect(result.map((item) => item.model.id)).toEqual(['dahua-vibration-1'])
  })

  it('hides everything for an empty listedIds set', () => {
    expect(filterSensorTabItems(items, { brand: 'all', kind: 'all', listedIds: new Set() })).toEqual([])
  })

  it('AND-combines brand, kind and listedIds', () => {
    const result = filterSensorTabItems(items, {
      brand: 'hikvision',
      kind: 'magnetic-contact',
      listedIds: new Set(['hikvision-magnetic-1']),
    })
    expect(result.map((item) => item.model.id)).toEqual(['hikvision-magnetic-1'])
  })
})
