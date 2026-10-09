import { create } from 'zustand'
import type { WallKind } from '../domain/project-file/project-types'
import { DEFAULT_VIEW_CONFIG, type ViewConfig } from '../domain/view/view-config-types'
import { installProjectStoreToEditorUiSync } from './project-store-to-editor-ui-sync'

/** `select`: default, drag/pan/select cameras, sensors, walls, hubs, cables and fire-alarm devices. `calibrate`: next two clicks on the stage draw a reference line. `wall`: clicks draw a chain of wall segments. `hub` / `riser` / `drop`: each click places a hub / a riser / a drop (the point where cables go up to the floor above / down to the floor below). `shaft`: a click reports the point and opens the floor-range dialog, which creates the shaft's markers (phase 6). `cable`: clicks draw one cable route from a device to a hub (or the reverse). `trunk`: a linked riser/drop's or a shaft marker's own route to another hub on its own floor (entered from the hub/shaft panel, not a toolbar toggle) - clicks add vertices, a click on another hub commits. */
export type ToolMode = 'select' | 'calibrate' | 'wall' | 'hub' | 'riser' | 'drop' | 'shaft' | 'cable' | 'trunk'

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
  /** At most one of the six `selected*Id` fields is set: each setter clears the other five, so Delete only ever removes one thing. */
  selectedWallId: string | null
  selectedSensorId: string | null
  selectedHubId: string | null
  selectedCableId: string | null
  selectedFireAlarmDeviceId: string | null
  /**
   * Set (by the shaft panel) just before entering `toolMode: 'trunk'` to make that tool draw ONE
   * cable's own route beyond its shaft - the cable `cableId` of floor `floorId` - from the selected
   * shaft opening on the active floor. null = the trunk tool draws a riser / drop's route as
   * usual. Cleared whenever the tool mode leaves `'trunk'`.
   */
  shaftLegDrawCable: { floorId: string; cableId: string } | null
  /** Cable type given to the cable drawn next. May go stale (type deleted, project replaced): consumers resolve `cableTypes.find(id) ?? cableTypes[0]`. */
  cableDrawTypeId: string | null
  /** Kind given to walls drawn next. */
  wallDrawKind: WallKind
  /** The decoded `HTMLImageElement` for the current plan, reused by the on-screen layer and export. Not persisted. */
  decodedImage: HTMLImageElement | null
  /** Whether the persisted calibration reference line is drawn on top of the plan. */
  showCalibrationLine: boolean
  /** Which kinds of items are drawn on the plan. UI-only: not persisted, not in undo history, never sets `hasUnsavedChanges`. */
  viewConfig: ViewConfig
  /** Stage container's on-screen size (from `floor-plan-stage.tsx`'s ResizeObserver). Lets the toolbar's zoom/fit buttons compute viewport math without the Stage's own refs. */
  stageSize: { width: number; height: number }
  notifications: UiNotification[]
  /**
   * M2 fix: bumped once per `replaceProject`/`resetProject` (mirroring
   * `ProjectState.loadSeq`, which the sync below watches) - included in the
   * stage's React `key` (`app.tsx`) so a project load ALWAYS forces a
   * remount, even when `activeFloorId` happens not to change (two legacy
   * files both wrap their one floor under the same id). Not persisted, not
   * itself project data.
   */
  projectLoadEpoch: number
  /**
   * True whenever the project store has changed since the last save/load.
   * Set automatically by the `project-store` subscription below;
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
  setSelectedFireAlarmDeviceId: (id: string | null) => void
  setCableDrawTypeId: (id: string | null) => void
  setShaftLegDrawCable: (target: { floorId: string; cableId: string } | null) => void
  /** Sets all six `selected*Id` fields to null in one update. */
  clearSelection: () => void
  setWallDrawKind: (kind: WallKind) => void
  setDecodedImage: (image: HTMLImageElement | null) => void
  setShowCalibrationLine: (show: boolean) => void
  /** Callers pass the next object (`withViewToggle`, `reveal*`); reset = `setViewConfig(DEFAULT_VIEW_CONFIG)`. */
  setViewConfig: (viewConfig: ViewConfig) => void
  setStageSize: (size: { width: number; height: number }) => void
  pushNotification: (kind: UiNotification['kind'], message: string) => void
  dismissNotification: (id: string) => void
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void
  /** Called only from `project-store-to-editor-ui-sync.ts`, once per detected project load. */
  bumpProjectLoadEpoch: () => void
}

export type EditorUiStore = EditorUiState & EditorUiActions

let notificationSeq = 0

const NO_SELECTION = {
  selectedCameraId: null,
  selectedWallId: null,
  selectedSensorId: null,
  selectedHubId: null,
  selectedCableId: null,
  selectedFireAlarmDeviceId: null,
}
type SelectionKey = keyof typeof NO_SELECTION

/** Selecting something clears the other five ids; clearing one id leaves the others alone. */
const selectOnly = (key: SelectionKey, id: string | null): Partial<Record<SelectionKey, string | null>> =>
  id ? { ...NO_SELECTION, [key]: id } : { [key]: null }

export const useEditorUiStore = create<EditorUiStore>((set) => ({
  toolMode: 'select',
  viewport: DEFAULT_VIEWPORT,
  ...NO_SELECTION,
  cableDrawTypeId: null,
  shaftLegDrawCable: null,
  wallDrawKind: 'opaque',
  decodedImage: null,
  showCalibrationLine: true,
  viewConfig: DEFAULT_VIEW_CONFIG,
  stageSize: { width: 0, height: 0 },
  notifications: [],
  hasUnsavedChanges: false,
  projectLoadEpoch: 0,

  setToolMode: (toolMode) => set(toolMode === 'trunk' ? { toolMode } : { toolMode, shaftLegDrawCable: null }),

  setViewport: (viewport) => set({ viewport }),

  setSelectedCameraId: (id) => set(selectOnly('selectedCameraId', id)),
  setSelectedWallId: (id) => set(selectOnly('selectedWallId', id)),
  setSelectedSensorId: (id) => set(selectOnly('selectedSensorId', id)),
  setSelectedHubId: (id) => set(selectOnly('selectedHubId', id)),
  setSelectedCableId: (id) => set(selectOnly('selectedCableId', id)),
  setSelectedFireAlarmDeviceId: (id) => set(selectOnly('selectedFireAlarmDeviceId', id)),
  setCableDrawTypeId: (cableDrawTypeId) => set({ cableDrawTypeId }),
  setShaftLegDrawCable: (shaftLegDrawCable) => set({ shaftLegDrawCable }),

  clearSelection: () => set(NO_SELECTION),

  setWallDrawKind: (wallDrawKind) => set({ wallDrawKind }),

  setDecodedImage: (decodedImage) => set({ decodedImage }),

  setShowCalibrationLine: (showCalibrationLine) => set({ showCalibrationLine }),

  setViewConfig: (viewConfig) => set({ viewConfig }),

  setStageSize: (stageSize) => set({ stageSize }),

  pushNotification: (kind, message) =>
    set((state) => ({
      notifications: [...state.notifications, { id: `n${++notificationSeq}`, kind, message }],
    })),

  dismissNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),

  bumpProjectLoadEpoch: () => set((state) => ({ projectLoadEpoch: state.projectLoadEpoch + 1 })),
}))

// Any project-store mutation to a tracked field (camera add/move/rotate/
// delete, scale set, new image, project load - but NOT a floor switch)
// marks the project dirty, resets selection/tool on a floor switch, and
// nulls `decodedImage` when the active floor's image identity changes. Save/
// load call sites clear the dirty flag themselves immediately after
// succeeding, so this fires-then-gets-overwritten in that case rather than
// needing to special-case it here.
installProjectStoreToEditorUiSync()
