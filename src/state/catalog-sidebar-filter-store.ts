import { create } from 'zustand'
import type { Brand, FormFactor } from '../catalog/camera/camera-catalog-schema'
import type { CatalogFeatureFilterKey } from '../catalog/camera/camera-catalog-feature-filters'
import type { FireAlarmKind } from '../domain/fire-alarm/fire-alarm-device-types'
import type { SensorKind } from '../domain/sensor/sensor-types'

/** Which catalog the sidebar shows. */
export type CatalogTab = 'cameras' | 'sensors' | 'fire-alarm'

/**
 * The catalog sidebar's filter state: which tab is active, and each tab's
 * own filter axes (brand/form-factor/priced-only/feature for cameras, a
 * kind filter for sensors and for fire-alarm devices). Split out of
 * `editor-ui-store.ts` (phase 5) to keep that file under 200 lines - this
 * state is UI-only (not persisted, not in undo history), same as it was
 * there. Consumers are the catalog panel files and the stage's drop/tab
 * wiring only.
 */
export interface CatalogSidebarFilterState {
  catalogTab: CatalogTab
  catalogBrandFilter: Brand | 'all'
  catalogFormFactorFilter: FormFactor | 'all'
  /** True hides catalog models with no Vietnam price ("price on request"). */
  catalogPricedOnlyFilter: boolean
  /** Selected feature filter keys (outdoor rating, mic, detection...), AND-combined with the two above. */
  catalogFeatureFilters: CatalogFeatureFilterKey[]
  /** Sensor catalog kind filter. 'all' means no filtering. */
  sensorCatalogKindFilter: SensorKind | 'all'
  /** Fire-alarm catalog kind filter. 'all' means no filtering. */
  fireAlarmCatalogKindFilter: FireAlarmKind | 'all'
}

export interface CatalogSidebarFilterActions {
  setCatalogTab: (tab: CatalogTab) => void
  setCatalogBrandFilter: (filter: Brand | 'all') => void
  setCatalogFormFactorFilter: (filter: FormFactor | 'all') => void
  setCatalogPricedOnlyFilter: (pricedOnly: boolean) => void
  /** Adds the key if absent, removes it if present. */
  toggleCatalogFeatureFilter: (key: CatalogFeatureFilterKey) => void
  setSensorCatalogKindFilter: (filter: SensorKind | 'all') => void
  setFireAlarmCatalogKindFilter: (filter: FireAlarmKind | 'all') => void
}

export type CatalogSidebarFilterStore = CatalogSidebarFilterState & CatalogSidebarFilterActions

export const useCatalogSidebarFilterStore = create<CatalogSidebarFilterStore>((set) => ({
  catalogTab: 'cameras',
  catalogBrandFilter: 'all',
  catalogFormFactorFilter: 'all',
  catalogPricedOnlyFilter: false,
  catalogFeatureFilters: [],
  sensorCatalogKindFilter: 'all',
  fireAlarmCatalogKindFilter: 'all',

  setCatalogTab: (catalogTab) => set({ catalogTab }),

  setCatalogBrandFilter: (catalogBrandFilter) => set({ catalogBrandFilter }),

  setCatalogFormFactorFilter: (catalogFormFactorFilter) => set({ catalogFormFactorFilter }),

  setCatalogPricedOnlyFilter: (catalogPricedOnlyFilter) => set({ catalogPricedOnlyFilter }),

  toggleCatalogFeatureFilter: (key) =>
    set((state) => ({
      catalogFeatureFilters: state.catalogFeatureFilters.includes(key)
        ? state.catalogFeatureFilters.filter((k) => k !== key)
        : [...state.catalogFeatureFilters, key],
    })),

  setSensorCatalogKindFilter: (sensorCatalogKindFilter) => set({ sensorCatalogKindFilter }),

  setFireAlarmCatalogKindFilter: (fireAlarmCatalogKindFilter) => set({ fireAlarmCatalogKindFilter }),
}))
