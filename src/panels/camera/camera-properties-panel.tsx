import { useMemo, type ChangeEvent } from 'react'
import { cameraModelById } from '../../catalog/camera/camera-catalog-loader'
import {
  resolveDefaultRangeM,
  resolveEffectiveHfovDeg,
  resolveEffectiveVfovDeg,
} from '../../domain/camera/camera-coverage-resolver'
import { computeDoriDistancesM, isApproximateDoriModel } from '../../domain/camera/dori-zone-distance-calculator'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
import { normalizeDegrees } from '../../domain/shared/fov-cone-sector-geometry'
import {
  computeMountedGroundCoverage,
  DEFAULT_MOUNT_HEIGHT_M,
  suggestTiltDegForFarEdgeM,
  TILT_MAX_DEG,
} from '../../domain/camera/mounted-camera-ground-coverage-calculator'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectActiveFloor, selectScale } from '../../state/project-store-floor-selectors'
import { CameraDoriDistanceTable } from './camera-dori-distance-table'
import { CameraGroundCoverageReadout } from './camera-ground-coverage-readout'
import { CameraMountingHeightTiltInputs } from './camera-mounting-height-tilt-inputs'
import { fieldLabelClass, inputClass } from './camera-properties-form-helpers'
import { CameraRangeInputWithReset } from './camera-range-input-with-reset'
import { CameraReadonlySummaryFields } from './camera-readonly-summary-fields'
import { CameraUnknownModelNotice } from './camera-unknown-model-notice'
import { CameraVarifocalHfovSlider } from './camera-varifocal-hfov-slider'

/**
 * Right-panel editor for the currently-selected camera: read-only catalog
 * facts, editable rotation/range/HFOV/mounting, floor coverage and the
 * computed DORI table. Pure forms over domain functions - no geometry/DORI
 * math lives here (see `camera-coverage-resolver.ts`,
 * `dori-zone-distance-calculator.ts`, `mounted-camera-ground-coverage-calculator.ts`).
 */
export function CameraPropertiesPanel() {
  const floor = useProjectStore(selectActiveFloor)
  const scale = useProjectStore(selectScale)
  const shafts = useProjectStore((s) => s.shafts)
  const updateCamera = useProjectStore((s) => s.updateCamera)
  const deleteCamera = useProjectStore((s) => s.deleteCamera)
  const selectedCameraId = useEditorUiStore((s) => s.selectedCameraId)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)
  // Stable identity across renders (same discipline as every other `shaftIds` call site) so the
  // allocator's own memo can hit while nothing relevant has changed.
  const shaftIds = useMemo(() => shafts.map((shaft) => shaft.id), [shafts])
  const itemLabels = useMemo(
    () => buildFloorItemLabels(floor, { shaftIds, fireAlarmModelById: fireAlarmModelSpecById }),
    [floor, shaftIds],
  )

  const cameras = floor.cameras
  const index = cameras.findIndex((c) => c.id === selectedCameraId)
  const camera = index >= 0 ? cameras[index] : null

  if (!camera) {
    return (
      <div data-testid="properties-panel" className="text-sm text-neutral-400">
        <h2 className="text-sm font-semibold text-neutral-700">Properties</h2>
        <p data-testid="properties-empty-state" className="mt-2">
          Select a camera or sensor on the plan to see and edit its properties.
        </p>
      </div>
    )
  }

  const model = cameraModelById(camera.modelId)
  const label = itemLabels.cameras[index]

  const handleDelete = () => {
    deleteCamera(camera.id)
    setSelectedCameraId(null)
  }

  if (!model) {
    return <CameraUnknownModelNotice label={label} modelId={camera.modelId} onDelete={handleDelete} />
  }

  const effectiveHfovDeg = resolveEffectiveHfovDeg(model.lens, camera.hfovDeg)
  const doriDistances = computeDoriDistancesM(model.pixelWidth, effectiveHfovDeg)
  const vfov = resolveEffectiveVfovDeg(model.lens, model.pixelWidth, model.pixelHeight, effectiveHfovDeg)
  // Mounting unset = legacy flat cone: no floor model, panel as before plus one button.
  const coverage =
    camera.mountHeightM === undefined
      ? null
      : computeMountedGroundCoverage({
          mountHeightM: camera.mountHeightM,
          tiltDeg: camera.tiltDeg ?? 0,
          vfovDeg: vfov?.vfovDeg ?? null,
          hfovDeg: effectiveHfovDeg,
          rangeM: camera.rangeM,
          doriSlantM: doriDistances,
        })
  const tiltApplicable = !isApproximateDoriModel(effectiveHfovDeg)

  const handleRotationChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.valueAsNumber
    if (!Number.isFinite(raw)) return
    updateCamera(camera.id, { rotationDeg: normalizeDegrees(raw) })
  }

  // Initial tilt puts the far edge at the current range, so the cone length barely changes on click.
  const handleSetMounting = () => {
    const tiltDeg =
      tiltApplicable && vfov
        ? Math.round(suggestTiltDegForFarEdgeM(DEFAULT_MOUNT_HEIGHT_M, camera.rangeM, vfov.vfovDeg))
        : TILT_MAX_DEG
    updateCamera(camera.id, { mountHeightM: DEFAULT_MOUNT_HEIGHT_M, tiltDeg })
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

      <CameraRangeInputWithReset
        rangeM={camera.rangeM}
        onChange={(rangeM) => updateCamera(camera.id, { rangeM })}
        onReset={() => updateCamera(camera.id, { rangeM: resolveDefaultRangeM(model, effectiveHfovDeg) })}
      />

      {model.lens.kind === 'varifocal' && (
        <CameraVarifocalHfovSlider
          hfovTeleDeg={model.lens.hfovTeleDeg}
          hfovWideDeg={model.lens.hfovWideDeg}
          hfovDeg={effectiveHfovDeg}
          onChange={(hfovDeg) => updateCamera(camera.id, { hfovDeg })}
        />
      )}

      <CameraMountingHeightTiltInputs
        mountHeightM={camera.mountHeightM}
        tiltDeg={camera.tiltDeg}
        tiltApplicable={tiltApplicable}
        onSetMounting={handleSetMounting}
        onChange={(patch) => updateCamera(camera.id, patch)}
        onClear={() => updateCamera(camera.id, { mountHeightM: undefined, tiltDeg: undefined })}
      />
      {coverage && (
        <CameraGroundCoverageReadout coverage={coverage} vfov={vfov} illuminationRangeM={model.illuminationRangeM} />
      )}

      <h3 className="mt-4 text-xs font-semibold text-neutral-700">DORI distances</h3>
      <CameraDoriDistanceTable
        computed={doriDistances}
        effectiveHfovDeg={effectiveHfovDeg}
        manufacturerDori={model.manufacturerDoriM}
        groundDistances={coverage?.doriGroundM}
        nearM={coverage?.nearM}
      />
    </div>
  )
}
