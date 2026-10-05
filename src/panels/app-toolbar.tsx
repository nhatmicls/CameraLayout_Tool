import type { ScaleCalibration } from '../domain/project-types'
import type { ToolMode } from '../state/editor-ui-store'

interface AppToolbarProps {
  hasImage: boolean
  scale: ScaleCalibration | null
  toolMode: ToolMode
  zoomPercent: number
  showCalibrationLine: boolean
  onOpenFileDialog: () => void
  onToggleCalibrate: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onToggleShowCalibrationLine: () => void
  /** Phase 7 (PNG/CSV export): disabled with a tooltip until an image is loaded; CSV also needs at least one placed camera. */
  hasCameras: boolean
  isExportingPng: boolean
  onExportPng: () => void
  onExportCsv: () => void
  /** Phase 6 (project save/load + undo/redo). */
  onSaveProject: () => void
  onOpenProjectDialog: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

const buttonClass =
  'rounded px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:hover:bg-transparent focus:outline focus:outline-2 focus:outline-blue-600'

/** Top toolbar: open image, calibration tool + status, zoom controls. Phases 6/7 add their own buttons here later. */
export function AppToolbar({
  hasImage,
  scale,
  toolMode,
  zoomPercent,
  showCalibrationLine,
  onOpenFileDialog,
  onToggleCalibrate,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleShowCalibrationLine,
  hasCameras,
  isExportingPng,
  onExportPng,
  onExportCsv,
  onSaveProject,
  onOpenProjectDialog,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: AppToolbarProps) {
  const isCalibrating = toolMode === 'calibrate'

  return (
    <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3">
      <button type="button" data-testid="load-image-button" onClick={onOpenFileDialog} className={buttonClass}>
        Open image
      </button>

      <div className="h-6 w-px bg-neutral-200" />

      <button type="button" data-testid="open-project-button" onClick={onOpenProjectDialog} className={buttonClass}>
        Open project
      </button>

      <button
        type="button"
        data-testid="save-project-button"
        onClick={onSaveProject}
        disabled={!hasImage}
        title={hasImage ? 'Download the project as a .json file' : 'Load a floor plan first'}
        className={buttonClass}
      >
        Save project
      </button>

      <div className="h-6 w-px bg-neutral-200" />

      <button
        type="button"
        data-testid="set-scale-button"
        onClick={onToggleCalibrate}
        disabled={!hasImage}
        aria-pressed={isCalibrating}
        className={`${buttonClass} ${isCalibrating ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
      >
        {isCalibrating ? 'Click two points…' : 'Set scale'}
      </button>

      {scale && (
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input type="checkbox" checked={showCalibrationLine} onChange={onToggleShowCalibrationLine} />
          Show ref. line
        </label>
      )}

      <span data-testid="scale-status" className={`text-sm ${scale ? 'text-neutral-600' : 'font-medium text-amber-600'}`}>
        {scale ? `1 m = ${scale.planPxPerMeter.toFixed(1)} px` : 'Scale not set'}
      </span>

      <div className="h-6 w-px bg-neutral-200" />

      <button
        type="button"
        data-testid="export-png-button"
        onClick={onExportPng}
        disabled={!hasImage || isExportingPng}
        title={hasImage ? 'Export the plan + BOM as a PNG' : 'Load a floor plan first'}
        className={buttonClass}
      >
        {isExportingPng ? 'Exporting…' : 'Export PNG'}
      </button>

      <button
        type="button"
        data-testid="export-csv-button"
        onClick={onExportCsv}
        disabled={!hasImage || !hasCameras}
        title={hasCameras ? 'Export the BOM as a CSV' : 'Place at least one camera first'}
        className={buttonClass}
      >
        Export CSV
      </button>

      <button
        type="button"
        data-testid="undo-button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className={buttonClass}
      >
        Undo
      </button>

      <button
        type="button"
        data-testid="redo-button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
        className={buttonClass}
      >
        Redo
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" data-testid="zoom-out-button" onClick={onZoomOut} disabled={!hasImage} className={buttonClass}>
          −
        </button>
        <span data-testid="zoom-readout" className="w-12 text-center text-sm text-neutral-600">
          {Math.round(zoomPercent)}%
        </span>
        <button type="button" data-testid="zoom-in-button" onClick={onZoomIn} disabled={!hasImage} className={buttonClass}>
          +
        </button>
        <button type="button" data-testid="zoom-fit-button" onClick={onFit} disabled={!hasImage} className={buttonClass}>
          Fit
        </button>
      </div>
    </div>
  )
}
