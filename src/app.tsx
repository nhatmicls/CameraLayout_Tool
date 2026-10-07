import { useCallback, useRef, type ChangeEvent } from 'react'
import { useProjectStore } from './state/project-store'
import {
  getActiveFloor,
  selectCables,
  selectCameras,
  selectFireAlarmDevices,
  selectImage,
  selectScale,
  selectSensors,
} from './state/project-store-floor-selectors'
import { useEditorUiStore } from './state/editor-ui-store'
import { useProjectUndoRedo } from './state/use-project-undo-redo'
import { useUndoRedoKeyboardShortcuts } from './state/use-undo-redo-keyboard-shortcuts'
import { useActiveFloorDecodedImageSync } from './canvas/floor/use-active-floor-decoded-image-sync'
import { useStagePanZoom } from './canvas/stage/use-stage-pan-zoom'
import { readImageFileAsDataUrl } from './file-io/browser/read-image-file-as-data-url'
import { useProjectFileActions } from './file-io/project-file/use-project-file-actions'
import { usePlanExportActions } from './export/shared/use-plan-export-actions'
import { AppToolbar } from './panels/app-shell/app-toolbar'
import { NotificationBanner } from './panels/app-shell/notification-banner'
import { EmptyStateImagePicker } from './panels/app-shell/empty-state-image-picker'
import { CatalogSidebar } from './panels/app-shell/catalog-sidebar'
import { SelectionPropertiesPanel } from './panels/app-shell/selection-properties-panel'
import { BillOfMaterialsPanel } from './panels/bom/bill-of-materials-panel'
import { CableEstimatePanel } from './panels/cable/cable-estimate-panel'
import { FloorPlanStage } from './canvas/stage/floor-plan-stage'
import { DEFAULT_VIEW_CONFIG } from './domain/view/view-config-types'
import { ViewConfigPanel } from './panels/app-shell/view-config-panel'
import { installDevTestHooks } from './dev-test-hooks'

const REPLACE_IMAGE_CONFIRM_MESSAGE =
  'Replacing the floor plan clears all placed cameras, sensors, fire-alarm devices, hubs, cables and the scale calibration. Continue?'

installDevTestHooks()

/**
 * App shell: top toolbar, three-column body (catalog sidebar | canvas |
 * properties/BOM placeholder), notification overlay. Owns the one file
 * input for loading a floor plan - both the toolbar button and the
 * empty-state's own button trigger it via `openFileDialog`.
 */
export function App() {
  const image = useProjectStore(selectImage)
  const scale = useProjectStore(selectScale)
  const cameras = useProjectStore(selectCameras)
  const sensors = useProjectStore(selectSensors)
  const fireAlarmDevices = useProjectStore(selectFireAlarmDevices)
  const cables = useProjectStore(selectCables)
  const setImage = useProjectStore((s) => s.setImage)

  const toolMode = useEditorUiStore((s) => s.toolMode)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const setViewConfig = useEditorUiStore((s) => s.setViewConfig)
  const showCalibrationLine = useEditorUiStore((s) => s.showCalibrationLine)
  const setShowCalibrationLine = useEditorUiStore((s) => s.setShowCalibrationLine)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const { viewport, zoomIn, zoomOut, fitToView } = useStagePanZoom()
  const { canUndo, canRedo, undo, redo } = useProjectUndoRedo()
  useUndoRedoKeyboardShortcuts()
  useActiveFloorDecodedImageSync()
  const { projectFileInputRef, openProjectFileDialog, handleSaveProject, handleProjectFileInputChange } = useProjectFileActions()
  const { isExportingPng, handleExportPng, handleExportCsv } = usePlanExportActions()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const openFileDialog = useCallback(() => fileInputRef.current?.click(), [])

  const loadImageFile = useCallback(
    async (file: File) => {
      const activeFloor = getActiveFloor(useProjectStore.getState())
      const { cameras, sensors, fireAlarmDevices, hubs, cables } = activeFloor
      const hasLayout = cameras.length > 0 || sensors.length > 0 || fireAlarmDevices.length > 0 || hubs.length > 0 || cables.length > 0
      if (hasLayout && !window.confirm(REPLACE_IMAGE_CONFIRM_MESSAGE)) {
        return
      }
      try {
        // `decoded.element` goes unused here: `useActiveFloorDecodedImageSync`
        // re-decodes from the data URL it sets below, the ONLY writer of
        // `decodedImage` (so a floor switch and a replace-on-the-same-floor
        // go through one code path).
        const { image: decoded, warning } = await readImageFileAsDataUrl(file)
        setImage({
          dataUrl: decoded.dataUrl,
          widthPx: decoded.widthPx,
          heightPx: decoded.heightPx,
          fileName: decoded.fileName,
        })
        setViewConfig(DEFAULT_VIEW_CONFIG) // a new plan always starts with everything shown
        if (warning) pushNotification('warning', warning)
      } catch (err) {
        pushNotification('error', err instanceof Error ? err.message : 'Failed to load the image file.')
      }
    },
    [setImage, setViewConfig, pushNotification],
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // allow re-selecting the same file later
      if (file) void loadImageFile(file)
    },
    [loadImageFile],
  )

  const handleToggleCalibrate = useCallback(() => {
    const next = toolMode === 'calibrate' ? 'select' : 'calibrate'
    setToolMode(next)
    if (next === 'calibrate') {
      pushNotification('info', 'Click two points on the floor plan to draw a reference line (Esc to cancel).')
    }
  }, [toolMode, setToolMode, pushNotification])

  return (
    <div className="flex h-screen flex-col bg-neutral-100">
      <AppToolbar
        hasImage={image !== null}
        scale={scale}
        toolMode={toolMode}
        zoomPercent={viewport.scale * 100}
        showCalibrationLine={showCalibrationLine}
        onOpenFileDialog={openFileDialog}
        onToggleCalibrate={handleToggleCalibrate}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fitToView}
        onToggleShowCalibrationLine={() => setShowCalibrationLine(!showCalibrationLine)}
        hasCameras={cameras.length > 0 || sensors.length > 0 || fireAlarmDevices.length > 0 || cables.length > 0}
        isExportingPng={isExportingPng}
        onExportPng={handleExportPng}
        onExportCsv={handleExportCsv}
        onSaveProject={handleSaveProject}
        onOpenProjectDialog={openProjectFileDialog}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <NotificationBanner />

      <div className="flex min-h-0 flex-1">
        <CatalogSidebar />

        <main className="min-w-0 flex-1">
          {image ? <FloorPlanStage /> : <EmptyStateImagePicker onOpenFileDialog={openFileDialog} onFileDropped={loadImageFile} />}
        </main>

        <aside className="w-[320px] flex-shrink-0 overflow-y-auto border-l border-neutral-200 bg-white p-3">
          <ViewConfigPanel />
          <SelectionPropertiesPanel />
          <CableEstimatePanel />
          <BillOfMaterialsPanel />
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        data-testid="load-image-input"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={projectFileInputRef}
        type="file"
        accept="application/json"
        data-testid="load-project-input"
        onChange={handleProjectFileInputChange}
        className="hidden"
      />
    </div>
  )
}
