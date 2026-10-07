import { create } from 'zustand'
import type { Brand, FormFactor } from '../catalog/camera/camera-catalog-schema'
import type { CatalogFeatureFilterKey } from '../catalog/camera/camera-catalog-feature-filters'
import type { FireAlarmKind } from '../domain/fire-alarm/fire-alarm-device-types'
import type { SensorKind } from '../domain/sensor/sensor-types'

/** Which catalog the sidebar shows. */
export type CatalogTab = 'cameras' | 'sensors' | 'fire-alarm' | 'control-panel'

/**
 * The catalog sidebar's filter state: which tab is active, and each tab's
 * own filter axes (brand/form-factor/priced-only/feature for cameras; brand +
 * kind for sensors; brand + kind for fire-alarm devices; brand + kind for
 * control-panel devices). Split out of `editor-ui-store.ts` (phase 5) to keep
 * that file under 200 lines - this state is UI-only (not persisted, not in
 * undo history), same as it was there. Consumers are the catalog panel
 * files and the stage's drop/tab wiring only.
 *
 * `catalogControllerFilter` (owner decision: compatibility is
 * controller-centric) is ONE shared "works with" selection read by the
 * Sensors, Fire alarm and Control panel tabs - a chosen controller model id,
 * or 'all'. Replaced the fire-alarm-only `fireAlarmCatalogControllerFilter`
 * when the Control panel tab was added (`FIRE_ALARM_KIND_CATALOG_TAB`): the
 * sensor catalog's own ids can now appear in a controller's
 * `compatibleDevices`, so the filter can no longer live under a
 * fire-alarm-specific name.
 */
export interface CatalogSidebarFilterState {
  catalogTab: CatalogTab
  catalogBrandFilter: Brand | 'all'
  catalogFormFactorFilter: FormFactor | 'all'
  /** True hides catalog models with no Vietnam price ("price on request"). */
  catalogPricedOnlyFilter: boolean
  /** Selected feature filter keys (outdoor rating, mic, detection...), AND-combined with the two above. */
  catalogFeatureFilters: CatalogFeatureFilterKey[]
  /** Sensor catalog brand filter (a brand id present in the sensor catalog OR the sensors-tab fire-alarm kinds). 'all' means no filtering. */
  sensorCatalogBrandFilter: string
  /** Sensor catalog kind filter - a `SensorKind` or a sensors-tab `FireAlarmKind` (magnetic-contact, environment-detector), merged into one drop-down. 'all' means no filtering. */
  sensorCatalogKindFilter: SensorKind | FireAlarmKind | 'all'
  /** Fire-alarm tab kind filter. 'all' means no filtering. */
  fireAlarmCatalogKindFilter: FireAlarmKind | 'all'
  /** Fire-alarm tab brand filter. 'all' means no filtering. */
  fireAlarmCatalogBrandFilter: string
  /** Control-panel tab kind filter. 'all' means no filtering. */
  controlPanelCatalogKindFilter: FireAlarmKind | 'all'
  /** Control-panel tab brand filter. 'all' means no filtering. */
  controlPanelCatalogBrandFilter: string
  /** Shared "works with" controller filter (Sensors, Fire alarm and Control panel tabs): a controller model id, or 'all'. */
  catalogControllerFilter: string
}

export interface CatalogSidebarFilterActions {
  setCatalogTab: (tab: CatalogTab) => void
  setCatalogBrandFilter: (filter: Brand | 'all') => void
  setCatalogFormFactorFilter: (filter: FormFactor | 'all') => void
  setCatalogPricedOnlyFilter: (pricedOnly: boolean) => void
  /** Adds the key if absent, removes it if present. */
  toggleCatalogFeatureFilter: (key: CatalogFeatureFilterKey) => void
  setSensorCatalogKindFilter: (filter: SensorKind | FireAlarmKind | 'all') => void
  setFireAlarmCatalogKindFilter: (filter: FireAlarmKind | 'all') => void
  setSensorCatalogBrandFilter: (filter: string) => void
  setFireAlarmCatalogBrandFilter: (filter: string) => void
  setControlPanelCatalogKindFilter: (filter: FireAlarmKind | 'all') => void
  setControlPanelCatalogBrandFilter: (filter: string) => void
  setCatalogControllerFilter: (filter: string) => void
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
  sensorCatalogBrandFilter: 'all',
  fireAlarmCatalogBrandFilter: 'all',
  controlPanelCatalogKindFilter: 'all',
  controlPanelCatalogBrandFilter: 'all',
  catalogControllerFilter: 'all',

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

  setSensorCatalogBrandFilter: (sensorCatalogBrandFilter) => set({ sensorCatalogBrandFilter }),

  setFireAlarmCatalogBrandFilter: (fireAlarmCatalogBrandFilter) => set({ fireAlarmCatalogBrandFilter }),

  setControlPanelCatalogKindFilter: (controlPanelCatalogKindFilter) => set({ controlPanelCatalogKindFilter }),

  setControlPanelCatalogBrandFilter: (controlPanelCatalogBrandFilter) => set({ controlPanelCatalogBrandFilter }),

  setCatalogControllerFilter: (catalogControllerFilter) => set({ catalogControllerFilter }),
}))
