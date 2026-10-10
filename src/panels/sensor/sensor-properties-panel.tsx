import { useMemo } from 'react'
import { sensorModelById } from '../../catalog/sensor/sensor-catalog-loader'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectActiveFloor, selectImage, selectScale, selectWalls } from '../../state/project-store-floor-selectors'
import { CameraUnknownModelNotice } from '../camera/camera-unknown-model-notice'
import { SensorBeamStatusReadout } from './sensor-beam-status-readout'
import { SensorCircleCoverageInputs } from './sensor-circle-coverage-inputs'
import { SensorReadonlySummaryFields } from './sensor-readonly-summary-fields'
import { SensorSectorCoverageInputs } from './sensor-sector-coverage-inputs'
import { ThermalDetectionRangeTable } from './thermal-detection-range-table'

/**
 * Right-panel editor for the currently-selected sensor: read-only catalog
 * facts, then a shape-specific editor (sector for pir/thermal, circle for
 * vibration, beam status for an IR beam), plus the thermal D/R/I table for
 * a thermal sensor. Pure form over domain functions - no geometry here (see
 * `sensor-coverage-resolver.ts`, `beam-sensor-line-check.ts`); every edit
 * goes through `updateSensor(id, patch)`. The sensor twin of
 * `camera-properties-panel.tsx`; `selection-properties-panel.tsx` decides
 * which of the two is mounted.
 */
export function SensorPropertiesPanel() {
  const floor = useProjectStore(selectActiveFloor)
  const walls = useProjectStore(selectWalls)
  const scale = useProjectStore(selectScale)
  const image = useProjectStore(selectImage)
  const shafts = useProjectStore((s) => s.shafts)
  const updateSensor = useProjectStore((s) => s.updateSensor)
  const deleteSensor = useProjectStore((s) => s.deleteSensor)
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  const setSelectedSensorId = useEditorUiStore((s) => s.setSelectedSensorId)
  const shaftIds = useMemo(() => shafts.map((shaft) => shaft.id), [shafts])
  const itemLabels = useMemo(
    () => buildFloorItemLabels(floor, { shaftIds, fireAlarmModelById: fireAlarmModelSpecById }),
    [floor, shaftIds],
  )

  const sensors = floor.sensors
  const index = sensors.findIndex((s) => s.id === selectedSensorId)
  const sensor = index >= 0 ? sensors[index] : null

  // Mirrors CameraPropertiesPanel's own empty state; selection-properties-panel.tsx only
  // mounts this component when selectedSensorId is set, so this guard is defensive only.
  if (!sensor) return null

  const model = sensorModelById(sensor.modelId)
  const label = itemLabels.sensors[index]

  const handleDelete = () => {
    deleteSensor(sensor.id)
    setSelectedSensorId(null)
  }

  if (!model) {
    return <CameraUnknownModelNotice label={label} modelId={sensor.modelId} onDelete={handleDelete} itemNoun="sensor" />
  }

  const handleChange = (patch: Parameters<typeof updateSensor>[1]) => updateSensor(sensor.id, patch)

  return (
    <div data-testid="properties-panel" className="text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          Properties <span data-testid="properties-sensor-number" className="text-neutral-400">({label})</span>
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

      <SensorReadonlySummaryFields sensor={sensor} model={model} scale={scale} />

      {sensor.shape === 'sector' && (model.kind === 'pir' || model.kind === 'thermal') && (
        <SensorSectorCoverageInputs sensor={sensor} model={model} onChange={handleChange} />
      )}

      {sensor.shape === 'circle' && model.kind === 'vibration' && (
        <SensorCircleCoverageInputs sensor={sensor} model={model} onChange={handleChange} />
      )}

      {sensor.shape === 'beam' && model.kind === 'beam' && scale && image && (
        <SensorBeamStatusReadout
          sensor={sensor}
          model={model}
          scale={scale}
          walls={walls}
          imageWidthPx={image.widthPx}
          imageHeightPx={image.heightPx}
          onChange={handleChange}
        />
      )}

      {model.kind === 'thermal' && sensor.shape === 'sector' && (
        <ThermalDetectionRangeTable human={model.detectionRangeM.human} vehicle={model.detectionRangeM.vehicle} />
      )}
    </div>
  )
}
