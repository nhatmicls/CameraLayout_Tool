import type { ChangeEvent } from 'react'
import { cameraModelById } from '../catalog/camera-catalog-loader'
import { resolveDefaultRangeM, resolveEffectiveHfovDeg } from '../domain/camera-coverage-resolver'
import { computeDoriDistancesM } from '../domain/dori-zone-distance-calculator'
import { normalizeDegrees } from '../domain/fov-cone-sector-geometry'
import { useEditorUiStore } from '../state/editor-ui-store'
import { useProjectStore } from '../state/project-store'
import { CameraDoriDistanceTable } from './camera-dori-distance-table'
import { CameraReadonlySummaryFields } from './camera-readonly-summary-fields'

const MIN_RANGE_M = 0.5
const MAX_RANGE_M = 500

const fieldLabelClass = 'mt-3 block text-xs font-medium text-neutral-500'
const inputClass =
  'mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline focus:outline-2 focus:outline-blue-600'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Right-panel editor for the currently-selected camera: read-only catalog
 * facts, editable rotation/range/HFOV, and the computed DORI table. Pure
 * forms over domain functions - no geometry/DORI math lives here (see
 * `camera-coverage-resolver.ts` / `dori-zone-distance-calculator.ts`).
 */
export function CameraPropertiesPanel() {
  const cameras = useProjectStore((s) => s.cameras)
  const scale = useProjectStore((s) => s.scale)
  const updateCamera = useProjectStore((s) => s.updateCamera)
  const deleteCamera = useProjectStore((s) => s.deleteCamera)
  const selectedCameraId = useEditorUiStore((s) => s.selectedCameraId)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)

  const index = cameras.findIndex((c) => c.id === selectedCameraId)
  const camera = index >= 0 ? cameras[index] : null

  if (!camera) {
    return (
      <div data-testid="properties-panel" className="text-sm text-neutral-400">
        <h2 className="text-sm font-semibold text-neutral-700">Properties</h2>
        <p data-testid="properties-empty-state" className="mt-2">
          Select a camera on the plan to see and edit its properties.
        </p>
      </div>
    )
  }

  const model = cameraModelById(camera.modelId)
  const label = `C${index + 1}`

  const handleDelete = () => {
    deleteCamera(camera.id)
    setSelectedCameraId(null)
  }

  if (!model) {
    // The catalog no longer has this camera's model (e.g. loaded from an older project file after a catalog change).
    return (
      <div data-testid="properties-panel" className="text-sm">
        <h2 className="text-sm font-semibold text-neutral-700">
          Properties <span className="text-neutral-400">({label})</span>
        </h2>
        <p data-testid="properties-unknown-model-note" className="mt-2 text-xs text-amber-700">
          This camera&apos;s model (&quot;{camera.modelId}&quot;) is no longer in the catalog. Its data can still be deleted.
        </p>
        <button
          type="button"
          data-testid="properties-delete-button"
          onClick={handleDelete}
          className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline focus:outline-2 focus:outline-red-800"
        >
          Delete camera
        </button>
      </div>
    )
  }

  const effectiveHfovDeg = resolveEffectiveHfovDeg(model.lens, camera.hfovDeg)
  const doriDistances = computeDoriDistancesM(model.pixelWidth, effectiveHfovDeg)

  const handleRotationChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.valueAsNumber
    if (!Number.isFinite(raw)) return
    updateCamera(camera.id, { rotationDeg: normalizeDegrees(raw) })
  }

  const handleRangeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.valueAsNumber
    if (!Number.isFinite(raw)) return
    updateCamera(camera.id, { rangeM: clamp(raw, MIN_RANGE_M, MAX_RANGE_M) })
  }

  const handleResetRange = () => {
    updateCamera(camera.id, { rangeM: resolveDefaultRangeM(model, effectiveHfovDeg) })
  }

  const handleHfovChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.valueAsNumber
    if (!Number.isFinite(raw)) return
    updateCamera(camera.id, { hfovDeg: raw })
  }

  return (
    <div data-testid="properties-panel" className="text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          Properties <span data-testid="properties-camera-number" className="text-neutral-400">({label})</span>
        </h2>
        <button
          type="button"
          data-testid="properties-delete-button"
          onClick={handleDelete}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline focus:outline-2 focus:outline-red-600"
        >
          Delete
        </button>
      </div>

      <CameraReadonlySummaryFields camera={camera} model={model} scale={scale} />

      <label className={fieldLabelClass} htmlFor="properties-rotation-input">
        Rotation (&deg;)
      </label>
      <input
        id="properties-rotation-input"
        data-testid="properties-rotation-input"
        type="number"
        min={0}
        max={359}
        step={1}
        value={Math.round(camera.rotationDeg)}
        onChange={handleRotationChange}
        className={inputClass}
      />

      <label className={fieldLabelClass} htmlFor="properties-range-input">
        Range (m)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="properties-range-input"
          data-testid="properties-range-input"
          type="number"
          min={MIN_RANGE_M}
          max={MAX_RANGE_M}
          step={0.1}
          value={camera.rangeM}
          onChange={handleRangeChange}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-blue-600 focus:outline focus:outline-2 focus:outline-blue-600"
        />
        <button
          type="button"
          data-testid="properties-range-reset-button"
          onClick={handleResetRange}
          className="flex-shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Reset
        </button>
      </div>

      {model.lens.kind === 'varifocal' && (
        <>
          <label className={fieldLabelClass} htmlFor="properties-hfov-slider">
            HFOV: <span data-testid="properties-hfov-value">{effectiveHfovDeg.toFixed(1)}&deg;</span>
          </label>
          <input
            id="properties-hfov-slider"
            data-testid="properties-hfov-slider"
            type="range"
            min={model.lens.hfovTeleDeg}
            max={model.lens.hfovWideDeg}
            step={0.1}
            value={effectiveHfovDeg}
            onChange={handleHfovChange}
            className="mt-1 w-full"
          />
        </>
      )}

      <h3 className="mt-4 text-xs font-semibold text-neutral-700">DORI distances</h3>
      <CameraDoriDistanceTable
        computed={doriDistances}
        effectiveHfovDeg={effectiveHfovDeg}
        manufacturerDori={model.manufacturerDoriM}
      />
    </div>
  )
}
