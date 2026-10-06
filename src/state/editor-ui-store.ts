import { create } from 'zustand'
import type { Brand, FormFactor } from '../catalog/camera/camera-catalog-schema'
import type { CatalogFeatureFilterKey } from '../catalog/camera/camera-catalog-feature-filters'
import type { WallKind } from '../domain/project-file/project-types'
import type { SensorKind } from '../domain/sensor/sensor-types'
import { useProjectStore } from './project-store'

/** Which catalog the sidebar shows (phase 6 owns the sidebar itself; the tab state lives here so phase 4's drop/selection wiring and phase 6's panel agree on it). */
export type CatalogTab = 'cameras' | 'sensors'

/** `select`: default, drag/pan/select cameras, sensors, walls, hubs and cables. `calibrate`: next two clicks on the stage draw a reference line. `wall`: clicks draw a chain of wall segments. `hub` / `riser` / `drop`: each click places a hub / a riser / a drop (the point where cables go up to the floor above / down to the floor below). `cable`: clicks draw one cable route from a device to a hub (or the reverse). */
export type ToolMode = 'select' | 'calibrate' | 'wall' | 'hub' | 'riser' | 'drop' | 'cable'

/** Stage transform. Lives here, never in `project-store`, so pan/zoom never touches undo history or the save payload. */
export interface Viewport {
  x: number
  y: number
  scale: number
}

export interface UiNotification {
  id: string
  kind: 'error' | 'warning' | 'info'
  message: string
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

export interface EditorUiState {
  toolMode: ToolMode
  viewport: Viewport
  selectedCameraId: string | null
  /** At most one of the five `selected*Id` fields is set: each setter clears the other four, so Delete only ever removes one thing. */
  selectedWallId: string | null
  selectedSensorId: string | null
  selectedHubId: string | null
  selectedCableId: string | null
  /** Cable type given to the cable drawn next. May go stale (type deleted, project replaced): consumers resolve `cableTypes.find(id) ?? cableTypes[0]`. */
  cableDrawTypeId: string | null
  /** Kind given to walls drawn next. */
  wallDrawKind: WallKind
  /** The decoded `HTMLImageElement` for the current plan, reused by the on-screen layer and export (phase 7). Not persisted. */
  decodedImage: HTMLImageElement | null
  /** Whether the persisted calibration reference line is drawn on top of the plan. */
  showCalibrationLine: boolean
  /** Stage container's on-screen size (from `floor-plan-stage.tsx`'s ResizeObserver). Lets the toolbar's zoom/fit buttons compute viewport math without the Stage's own refs. */
  stageSize: { width: number; height: number }
  notifications: UiNotification[]
  /** Catalog sidebar filters (phase 5). 'all' means no filtering on that axis. */
  catalogBrandFilter: Brand | 'all'
  catalogFormFactorFilter: FormFactor | 'all'
  /** True hides catalog models with no Vietnam price ("price on request"). */
  catalogPricedOnlyFilter: boolean
  /** Selected feature filter keys (outdoor rating, mic, detection...), AND-combined with the three above. UI-only: not persisted, not in undo history. */
  catalogFeatureFilters: CatalogFeatureFilterKey[]
  /** Sidebar tab (phase 6). UI-only: not persisted, not in undo history. */
  catalogTab: CatalogTab
  /** Sensor catalog kind filter (phase 6). 'all' means no filtering. UI-only: not persisted, not in undo history. */
  sensorCatalogKindFilter: SensorKind | 'all'
  /**
   * True whenever the project store has changed since the last save/load
   * (phase 6). Set automatically by the `project-store` subscription below;
   * save/load call sites clear it themselves right after succeeding. Drives
   * the "discard unsaved work?" confirmations and the `beforeunload` prompt.
   */
  hasUnsavedChanges: boolean
}

export interface EditorUiActions {
  setToolMode: (mode: ToolMode) => void
  setViewport: (viewport: Viewport) => void
  setSelectedCameraId: (id: string | null) => void
  setSelectedWallId: (id: string | null) => void
  setSelectedSensorId: (id: string | null) => void
  setSelectedHubId: (id: string | null) => void
  setSelectedCableId: (id: string | null) => void
  setCableDrawTypeId: (id: string | null) => void
  /** Sets all five `selected*Id` fields to null in one update. */
  clearSelection: () => void
  setWallDrawKind: (kind: WallKind) => void
  setDecodedImage: (image: HTMLImageElement | null) => void
  setShowCalibrationLine: (show: boolean) => void
  setStageSize: (size: { width: number; height: number }) => void
  pushNotification: (kind: UiNotification['kind'], message: string) => void
  dismissNotification: (id: string) => void
  setCatalogBrandFilter: (filter: Brand | 'all') => void
  setCatalogFormFactorFilter: (filter: FormFactor | 'all') => void
  setCatalogPricedOnlyFilter: (pricedOnly: boolean) => void
  /** Adds the key if absent, removes it if present. */
  toggleCatalogFeatureFilter: (key: CatalogFeatureFilterKey) => void
  setCatalogTab: (tab: CatalogTab) => void
  setSensorCatalogKindFilter: (filter: SensorKind | 'all') => void
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void
}

export type EditorUiStore = EditorUiState & EditorUiActions

let notificationSeq = 0

const NO_SELECTION = {
  selectedCameraId: null,
  selectedWallId: null,
  selectedSensorId: null,
  selectedHubId: null,
  selectedCableId: null,
}
type SelectionKey = keyof typeof NO_SELECTION

/** Selecting something clears the other four ids; clearing one id leaves the others alone. */
const selectOnly = (key: SelectionKey, id: string | null): Partial<Record<SelectionKey, string | null>> =>
  id ? { ...NO_SELECTION, [key]: id } : { [key]: null }

export const useEditorUiStore = create<EditorUiStore>((set) => ({
  toolMode: 'select',
  viewport: DEFAULT_VIEWPORT,
  ...NO_SELECTION,
  cableDrawTypeId: null,
  wallDrawKind: 'opaque',
  decodedImage: null,
  showCalibrationLine: true,
  stageSize: { width: 0, height: 0 },
  notifications: [],
  catalogBrandFilter: 'all',
  catalogFormFactorFilter: 'all',
  catalogPricedOnlyFilter: false,
  catalogFeatureFilters: [],
  catalogTab: 'cameras',
  sensorCatalogKindFilter: 'all',
  hasUnsavedChanges: false,

  setToolMode: (toolMode) => set({ toolMode }),

  setViewport: (viewport) => set({ viewport }),

  setSelectedCameraId: (id) => set(selectOnly('selectedCameraId', id)),
  setSelectedWallId: (id) => set(selectOnly('selectedWallId', id)),
  setSelectedSensorId: (id) => set(selectOnly('selectedSensorId', id)),
  setSelectedHubId: (id) => set(selectOnly('selectedHubId', id)),
  setSelectedCableId: (id) => set(selectOnly('selectedCableId', id)),
  setCableDrawTypeId: (cableDrawTypeId) => set({ cableDrawTypeId }),

  clearSelection: () => set(NO_SELECTION),

  setWallDrawKind: (wallDrawKind) => set({ wallDrawKind }),

  setDecodedImage: (decodedImage) => set({ decodedImage }),

  setShowCalibrationLine: (showCalibrationLine) => set({ showCalibrationLine }),

  setStageSize: (stageSize) => set({ stageSize }),

  pushNotification: (kind, message) =>
    set((state) => ({
      notifications: [...state.notifications, { id: `n${++notificationSeq}`, kind, message }],
    })),

  dismissNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

  setCatalogBrandFilter: (catalogBrandFilter) => set({ catalogBrandFilter }),

  setCatalogFormFactorFilter: (catalogFormFactorFilter) => set({ catalogFormFactorFilter }),

  setCatalogPricedOnlyFilter: (catalogPricedOnlyFilter) => set({ catalogPricedOnlyFilter }),

  toggleCatalogFeatureFilter: (key) =>
    set((state) => ({
      catalogFeatureFilters: state.catalogFeatureFilters.includes(key)
        ? state.catalogFeatureFilters.filter((k) => k !== key)
        : [...state.catalogFeatureFilters, key],
    })),

  setCatalogTab: (catalogTab) => set({ catalogTab }),

  setSensorCatalogKindFilter: (sensorCatalogKindFilter) => set({ sensorCatalogKindFilter }),

  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),
}))

// Any project-store mutation (camera add/move/rotate/delete, scale set, new
// image, project load) marks the project dirty. Save/load call sites clear
// the flag themselves immediately after succeeding, so this fires-then-gets-
// overwritten in that case rather than needing to special-case it here.
useProjectStore.subscribe(() => useEditorUiStore.getState().setHasUnsavedChanges(true))
