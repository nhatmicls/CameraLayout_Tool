import { useProjectStore } from './state/project-store'
import { selectImage, selectScale } from './state/project-store-floor-selectors'
import { useEditorUiStore } from './state/editor-ui-store'
import { useProjectUndoRedo } from './state/use-project-undo-redo'
import { useUndoRedoKeyboardShortcuts } from './state/use-undo-redo-keyboard-shortcuts'
import { useActiveFloorDecodedImageSync } from './canvas/floor/use-active-floor-decoded-image-sync'
import { useStagePanZoom } from './canvas/stage/use-stage-pan-zoom'
import { useFloorPlanImageLoader } from './file-io/browser/use-floor-plan-image-loader'
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
import { FloorTabsBar } from './panels/floor/floor-tabs-bar'
import { ViewConfigPanel } from './panels/app-shell/view-config-panel'
import { installDevTestHooks } from './dev-test-hooks'

installDevTestHooks()

/**
 * App shell: top toolbar, floor tab bar, three-column body (catalog sidebar |
 * canvas | properties/BOM placeholder), notification overlay. Owns the one
 * file input for loading a floor plan onto the active floor - both the
 * toolbar button and the empty-state's own button trigger it via
 * `openFileDialog`. The stage is keyed by `activeFloorId` + `projectLoadEpoch`
 * so a floor switch OR a project load remounts it: every per-stage
 * chain/listener (pending calibration line, wall/cable drawing overlays)
 * resets for free with no bespoke code. `projectLoadEpoch` (M2) covers the
 * case a plain `activeFloorId` key would miss: two project loads landing on
 * the SAME floor id (two legacy files both wrapped as `LEGACY_FLOOR_ID`).
 */
export function App() {
  const image = useProjectStore(selectImage)
  const scale = useProjectStore(selectScale)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  const floorCount = useProjectStore((s) => s.floors.length)
  const projectLoadEpoch = useEditorUiStore((s) => s.projectLoadEpoch)
  const canSaveProject = useProjectStore((s) => s.floors.some((floor) => floor.image !== null))
  // Export CSV is project-wide (drift addendum): any floor's own camera/sensor/fire-alarm/cable
  // counts, not just the active floor's.
  const hasAnyBomContent = useProjectStore((s) =>
    s.floors.some((floor) => floor.cameras.length > 0 || floor.sensors.length > 0 || floor.fireAlarmDevices.length > 0 || floor.cables.length > 0),
  )

  const toolMode = useEditorUiStore((s) => s.toolMode)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const showCalibrationLine = useEditorUiStore((s) => s.showCalibrationLine)
  const setShowCalibrationLine = useEditorUiStore((s) => s.setShowCalibrationLine)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const { viewport, zoomIn, zoomOut, fitToView } = useStagePanZoom()
  const { canUndo, canRedo, undo, redo } = useProjectUndoRedo()
  useUndoRedoKeyboardShortcuts()
  useActiveFloorDecodedImageSync()
  const { projectFileInputRef, openProjectFileDialog, handleSaveProject, handleProjectFileInputChange } = useProjectFileActions()
  const { isExportingPng, handleExportPng, handleExportCsv, isExportingAllFloors, handleExportAllFloors } = usePlanExportActions()
  const { fileInputRef, openFileDialog, loadImageFile, handleFileInputChange } = useFloorPlanImageLoader()

  const handleToggleCalibrate = () => {
    const next = toolMode === 'calibrate' ? 'select' : 'calibrate'
    setToolMode(next)
    if (next === 'calibrate') {
      pushNotification('info', 'Click two points on the floor plan to draw a reference line (Esc to cancel).')
    }
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-100">
      <AppToolbar
        hasImage={image !== null}
        canSaveProject={canSaveProject}
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
        hasAnyBomContent={hasAnyBomContent}
        isExportingPng={isExportingPng}
        onExportPng={handleExportPng}
        onExportCsv={handleExportCsv}
        floorCount={floorCount}
        isExportingAllFloors={isExportingAllFloors}
        onExportAllFloors={handleExportAllFloors}
        onSaveProject={handleSaveProject}
        onOpenProjectDialog={openProjectFileDialog}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      <FloorTabsBar />

      <NotificationBanner />

      <div className="flex min-h-0 flex-1">
        <CatalogSidebar />

        <main className="min-w-0 flex-1">
          {image ? (
            <FloorPlanStage key={`${activeFloorId}-${projectLoadEpoch}`} />
          ) : (
            <EmptyStateImagePicker onOpenFileDialog={openFileDialog} onFileDropped={loadImageFile} />
          )}
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
