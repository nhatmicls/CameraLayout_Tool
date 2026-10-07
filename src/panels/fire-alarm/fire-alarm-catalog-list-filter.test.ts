import { describe, expect, it } from 'vitest'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import {
  filterFireAlarmCatalogModels,
  groupControllerOptionsByPlacement,
  resolveControllerListedIds,
  type FireAlarmCatalogFilterCriteria,
} from './fire-alarm-catalog-list-filter'

const ALL: FireAlarmCatalogFilterCriteria = { brand: 'all', kind: 'all', compatibleWithControllerId: 'all' }
const ids = (criteria: Partial<FireAlarmCatalogFilterCriteria>) =>
  filterFireAlarmCatalogModels(fireAlarmModels, { ...ALL, ...criteria }).map((model) => model.id)

describe('filterFireAlarmCatalogModels (real catalog)', () => {
  it('returns every record with no filter', () => {
    expect(ids({})).toHaveLength(fireAlarmModels.length)
  })

  it('filters by kind and by brand', () => {
    const smokeIds = fireAlarmModels.filter((model) => model.kind === 'smoke-detector').map((model) => model.id)
    expect(smokeIds).toContain('hikvision-hf-s2')
    expect(ids({ kind: 'smoke-detector' }).sort()).toEqual([...smokeIds].sort())
    expect(ids({ brand: 'hikvision' })).toHaveLength(fireAlarmModels.length)
    expect(ids({ brand: 'no-such-brand' })).toEqual([])
  })

  it('keeps the chosen controller and exactly the devices it lists', () => {
    const hub = fireAlarmModels.find((model) => model.id === 'hikvision-ds-pwa96-m-we')
    if (!hub || !('compatibleDevices' in hub)) throw new Error('hub record missing')
    const expected = [hub.id, ...hub.compatibleDevices.map((entry) => entry.modelId)].sort()
    expect(ids({ compatibleWithControllerId: hub.id }).sort()).toEqual(expected)
  })

  it('shows only the controller itself when it lists nothing', () => {
    const emptyController = { ...fireAlarmModels.find((model) => model.id === 'hikvision-ds-pwa96-m2h-wb')!, compatibleDevices: [] }
    const models = [emptyController, ...fireAlarmModels.filter((model) => model.id !== emptyController.id)]
    expect(filterFireAlarmCatalogModels(models, { ...ALL, compatibleWithControllerId: emptyController.id }).map((m) => m.id)).toEqual([
      emptyController.id,
    ])
  })

  it('keeps 433 MHz (-WB) peripherals for the 433 MHz hub and not the 868 MHz (-WE) ones', () => {
    const result = ids({ compatibleWithControllerId: 'hikvision-ds-pwa96-m2h-wb' })
    expect(result).toContain('hikvision-ds-pdsmk-s-wb')
    expect(result).not.toContain('hikvision-ds-pdsmk-s-we')
  })

  it('hides a standalone device and other controllers under a controller filter', () => {
    const result = ids({ compatibleWithControllerId: 'hikvision-ds-pha48-ep' })
    expect(result).not.toContain('hikvision-hf-s2')
    expect(result).not.toContain('hikvision-ds-pha64-lp-b')
    expect(result).toContain('hikvision-ds-pdht-e-we')
  })

  it('combines the controller filter with the kind filter, keeping the chosen controller visible', () => {
    expect(ids({ compatibleWithControllerId: 'hikvision-ds-pwa96-m-we', kind: 'co-detector' }).sort()).toEqual([
      'hikvision-ds-pdco-e-we',
      'hikvision-ds-pwa96-m-we',
    ])
  })

  it('filters a tab subset that holds no controllers by looking the controller up in the full catalog', () => {
    const detectorsOnly = fireAlarmModels.filter((model) => model.kind === 'smoke-detector' || model.kind === 'heat-detector')
    const criteria = { ...ALL, compatibleWithControllerId: 'hikvision-ds-pha48-ep' }
    const result = filterFireAlarmCatalogModels(detectorsOnly, criteria, fireAlarmModels).map((model) => model.id)
    expect(result).toContain('hikvision-ds-pdht-e-wb')
    expect(result).not.toContain('hikvision-hf-s2')
    expect(result).not.toContain('hikvision-ds-pha48-ep')
    // Without the full catalog as the lookup source nothing can be listed (the regression this guards).
    expect(filterFireAlarmCatalogModels(detectorsOnly, criteria)).toEqual([])
  })

  it('hides everything for an id that is not a controller', () => {
    expect(ids({ compatibleWithControllerId: 'hikvision-hf-s2' })).toEqual(['hikvision-hf-s2'])
    expect(ids({ compatibleWithControllerId: 'unknown-id' })).toEqual([])
  })
})

describe('resolveControllerListedIds (real catalog)', () => {
  it('returns null for "all" (no filter)', () => {
    expect(resolveControllerListedIds(fireAlarmModels, 'all')).toBeNull()
  })

  it('returns the exact compatibleDevices modelId set for a known controller', () => {
    const hub = fireAlarmModels.find((model) => model.id === 'hikvision-ds-pwa96-m-we')
    if (!hub || !('compatibleDevices' in hub)) throw new Error('hub record missing')
    const listed = resolveControllerListedIds(fireAlarmModels, hub.id)
    expect(listed).not.toBeNull()
    expect([...listed!].sort()).toEqual(hub.compatibleDevices.map((entry) => entry.modelId).sort())
  })

  it('returns an empty set for an id that matches no controller', () => {
    expect(resolveControllerListedIds(fireAlarmModels, 'unknown-id')).toEqual(new Set())
  })
})

describe('groupControllerOptionsByPlacement', () => {
  const options = [
    { value: 'panel-a', label: 'Panel A' },
    { value: 'panel-b', label: 'Panel B' },
    { value: 'panel-c', label: 'Panel C' },
  ]

  it('splits options into placed / not-placed by the given id set, preserving order', () => {
    const result = groupControllerOptionsByPlacement(options, new Set(['panel-b']))
    expect(result.placed).toEqual([{ value: 'panel-b', label: 'Panel B' }])
    expect(result.notPlaced).toEqual([
      { value: 'panel-a', label: 'Panel A' },
      { value: 'panel-c', label: 'Panel C' },
    ])
  })

  it('puts everything in "not placed" when nothing is placed', () => {
    const result = groupControllerOptionsByPlacement(options, new Set())
    expect(result.placed).toEqual([])
    expect(result.notPlaced).toEqual(options)
  })

  it('puts everything in "placed" when every option is placed', () => {
    const result = groupControllerOptionsByPlacement(options, new Set(['panel-a', 'panel-b', 'panel-c']))
    expect(result.placed).toEqual(options)
    expect(result.notPlaced).toEqual([])
  })
})
