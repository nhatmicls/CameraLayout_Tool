import type { ScaleCalibration } from '../../domain/project-file/project-types'
import type { ToolMode } from '../../state/editor-ui-store'
import { FireCoverageModeControls } from '../fire-alarm/fire-coverage-mode-controls'
import { CableToolControls } from './cable-tool-controls'
import { ToolbarExportButtons } from './toolbar-export-buttons'
import { WallToolControls } from './wall-tool-controls'

interface AppToolbarProps {
  hasImage: boolean
  /** H1: whether ANY floor has a plan image - gates Save, independently of `hasImage` (the ACTIVE floor only), so other floors' work can still be saved while viewing an image-less one. */
  canSaveProject: boolean
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
  /** Export CSV: whether ANY floor has a placed camera, sensor, fire-alarm device or cable (phase 7 - CSV is project-wide). */
  hasAnyBomContent: boolean
  isExportingPng: boolean
  onExportPng: () => void
  onExportCsv: () => void
  /** Phase 7: "Export all floors", shown only when there is more than one. */
  floorCount: number
  isExportingAllFloors: boolean
  onExportAllFloors: () => void
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

/** Top toolbar: open image, project save/load, calibration tool + status, wall tool, hub + cable tools, fire-detector coverage mode, export, undo/redo, zoom controls. Wraps onto a second row in a narrow window instead of clipping. */
export function AppToolbar({
  hasImage,
  canSaveProject,
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
  hasAnyBomContent,
  isExportingPng,
  onExportPng,
  onExportCsv,
  floorCount,
  isExportingAllFloors,
  onExportAllFloors,
  onSaveProject,
  onOpenProjectDialog,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: AppToolbarProps) {
  const isCalibrating = toolMode === 'calibrate'
  // M2 review fix: disables all three export buttons together while either async export is in flight.
  const isExporting = isExportingPng || isExportingAllFloors

  return (
    <div className="flex min-h-12 flex-shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-1">
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
        disabled={!canSaveProject}
        title={canSaveProject ? 'Download the project as a .json file' : 'Load a floor plan on at least one floor first'}
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

      <WallToolControls hasImage={hasImage} buttonClass={buttonClass} />

      <div className="h-6 w-px bg-neutral-200" />

      <CableToolControls hasImage={hasImage} buttonClass={buttonClass} />

      <FireCoverageModeControls hasImage={hasImage} />

      <div className="h-6 w-px bg-neutral-200" />

      <ToolbarExportButtons
        hasActiveFloorImage={hasImage}
        isExportingPng={isExportingPng}
        onExportPng={onExportPng}
        hasAnyBomContent={hasAnyBomContent}
        onExportCsv={onExportCsv}
        floorCount={floorCount}
        isExportingAllFloors={isExportingAllFloors}
        onExportAllFloors={onExportAllFloors}
        isExporting={isExporting}
        buttonClass={buttonClass}
      />

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
