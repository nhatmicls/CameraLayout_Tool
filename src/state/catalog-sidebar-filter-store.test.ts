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

  it('switches to the control-panel tab and its own brand/kind filters independently', () => {
    useCatalogSidebarFilterStore.getState().setCatalogTab('control-panel')
    useCatalogSidebarFilterStore.getState().setControlPanelCatalogKindFilter('keypad')
    useCatalogSidebarFilterStore.getState().setControlPanelCatalogBrandFilter('hikvision')
    expect(useCatalogSidebarFilterStore.getState()).toMatchObject({
      catalogTab: 'control-panel',
      controlPanelCatalogKindFilter: 'keypad',
      controlPanelCatalogBrandFilter: 'hikvision',
    })
  })
})

describe('useCatalogSidebarFilterStore shared "works with" controller filter', () => {
  beforeEach(() => {
    useCatalogSidebarFilterStore.setState({ catalogControllerFilter: 'all' })
  })

  it('defaults to "all" and is settable independently of the tab', () => {
    expect(useCatalogSidebarFilterStore.getState().catalogControllerFilter).toBe('all')
    useCatalogSidebarFilterStore.getState().setCatalogControllerFilter('hikvision-ds-pha48-ep')
    expect(useCatalogSidebarFilterStore.getState().catalogControllerFilter).toBe('hikvision-ds-pha48-ep')
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
