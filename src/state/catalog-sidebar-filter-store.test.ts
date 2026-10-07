import { beforeEach, describe, expect, it } from 'vitest'
import { useCatalogSidebarFilterStore } from './catalog-sidebar-filter-store'

describe('useCatalogSidebarFilterStore catalog tab and kind filters', () => {
  beforeEach(() => {
    useCatalogSidebarFilterStore.setState({
      catalogTab: 'cameras',
      sensorCatalogKindFilter: 'all',
      fireAlarmCatalogKindFilter: 'all',
    })
  })

  it('defaults to the cameras tab and no kind filter', () => {
    expect(useCatalogSidebarFilterStore.getState()).toMatchObject({
      catalogTab: 'cameras',
      sensorCatalogKindFilter: 'all',
      fireAlarmCatalogKindFilter: 'all',
    })
  })

  it('switches tab and sensor kind filter independently', () => {
    useCatalogSidebarFilterStore.getState().setCatalogTab('sensors')
    useCatalogSidebarFilterStore.getState().setSensorCatalogKindFilter('pir')
    expect(useCatalogSidebarFilterStore.getState()).toMatchObject({ catalogTab: 'sensors', sensorCatalogKindFilter: 'pir' })
  })

  it('switches to the fire-alarm tab and its kind filter independently', () => {
    useCatalogSidebarFilterStore.getState().setCatalogTab('fire-alarm')
    useCatalogSidebarFilterStore.getState().setFireAlarmCatalogKindFilter('smoke-detector')
    expect(useCatalogSidebarFilterStore.getState()).toMatchObject({
      catalogTab: 'fire-alarm',
      fireAlarmCatalogKindFilter: 'smoke-detector',
    })
  })
})

describe('useCatalogSidebarFilterStore catalog feature filters', () => {
  beforeEach(() => {
    useCatalogSidebarFilterStore.setState({ catalogFeatureFilters: [] })
  })

  it('starts with no feature filter selected', () => {
    expect(useCatalogSidebarFilterStore.getState().catalogFeatureFilters).toEqual([])
  })

  it('adds a key that is absent and removes one that is present', () => {
    const { toggleCatalogFeatureFilter } = useCatalogSidebarFilterStore.getState()
    toggleCatalogFeatureFilter('built-in-mic')
    toggleCatalogFeatureFilter('outdoor-rated')
    expect(useCatalogSidebarFilterStore.getState().catalogFeatureFilters).toEqual(['built-in-mic', 'outdoor-rated'])

    toggleCatalogFeatureFilter('built-in-mic')
    expect(useCatalogSidebarFilterStore.getState().catalogFeatureFilters).toEqual(['outdoor-rated'])
  })

  it('replaces the array instead of mutating it', () => {
    const before = useCatalogSidebarFilterStore.getState().catalogFeatureFilters
    useCatalogSidebarFilterStore.getState().toggleCatalogFeatureFilter('human-detection')
    expect(useCatalogSidebarFilterStore.getState().catalogFeatureFilters).not.toBe(before)
    expect(before).toEqual([])
  })
})

describe('useCatalogSidebarFilterStore camera filters', () => {
  it('sets brand, form factor and priced-only independently', () => {
    const { setCatalogBrandFilter, setCatalogFormFactorFilter, setCatalogPricedOnlyFilter } = useCatalogSidebarFilterStore.getState()
    setCatalogBrandFilter('hikvision')
    setCatalogFormFactorFilter('dome')
    setCatalogPricedOnlyFilter(true)
    expect(useCatalogSidebarFilterStore.getState()).toMatchObject({
      catalogBrandFilter: 'hikvision',
      catalogFormFactorFilter: 'dome',
      catalogPricedOnlyFilter: true,
    })
  })
})
