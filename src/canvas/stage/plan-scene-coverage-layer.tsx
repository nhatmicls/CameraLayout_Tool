import { useMemo, type RefObject } from 'react'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedCamera, Wall } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { CameraFovConesLayer } from '../camera/camera-fov-cones-layer'
import { FireDetectorCoverageShapes } from '../fire-alarm/fire-detector-coverage-shapes'
import { SensorCoverageShapes } from '../sensor/sensor-coverage-shapes'
import type { ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'

export interface PlanSceneCoverageLayerProps {
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
  fireAlarmSettings: FireAlarmSettings
  /** Always the full wall list - hiding walls in the view config never changes occlusion. */
  walls: Wall[]
  planPxPerMeter: number
  scaleIsSet: boolean
  imageWidthPx: number
  imageHeightPx: number
  wallClearancePx: number
  /** Null = nothing highlighted (also what a non-interactive render passes). */
  selectedCameraId: string | null
  selectedSensorId: string | null
  selectedFireAlarmDeviceId: string | null
  coneLiveHandles: RefObject<Map<string, ConeLiveHandle>>
  /** View config: cameras / sensors whose cone / coverage shape is skipped by id. */
  hiddenCameraIds: ReadonlySet<string>
  hiddenSensorIds: ReadonlySet<string>
  /** False hides the whole Layer and keeps every shape mounted (the cable tool). */
  visible: boolean
}

/**
 * The cones Layer's full contents, pulled out of `plan-scene-layers.tsx`
 * (the twin of `plan-scene-markers-layer.tsx`) to keep that file under the
 * project's line-count guideline, plus the view config's hidden-id sets: camera FOV cones, then sensor
 * coverage, then fire-detector coverage circles - one non-listening Layer.
 */
export function PlanSceneCoverageLayer({
  cameras,
  sensors,
  fireAlarmDevices,
  fireAlarmSettings,
  walls,
  planPxPerMeter,
  scaleIsSet,
  imageWidthPx,
  imageHeightPx,
  wallClearancePx,
  selectedCameraId,
  selectedSensorId,
  selectedFireAlarmDeviceId,
  coneLiveHandles,
  hiddenCameraIds,
  hiddenSensorIds,
  visible,
}: PlanSceneCoverageLayerProps) {
  const maxClipRadiusPx = useMemo(() => Math.hypot(imageWidthPx, imageHeightPx), [imageWidthPx, imageHeightPx]) // perf cap, image diagonal

  return (
    <CameraFovConesLayer
      cameras={cameras}
      walls={walls}
      planPxPerMeter={planPxPerMeter}
      selectedCameraId={selectedCameraId}
      coneLiveHandles={coneLiveHandles}
      hiddenIds={hiddenCameraIds}
      visible={visible}
    >
      <SensorCoverageShapes
        sensors={sensors}
        hiddenIds={hiddenSensorIds}
        walls={walls}
        planPxPerMeter={planPxPerMeter}
        selectedSensorId={selectedSensorId}
        nodeRegistry={coneLiveHandles}
        wallClearancePx={wallClearancePx}
        maxClipRadiusPx={maxClipRadiusPx}
      />
      <FireDetectorCoverageShapes
        devices={fireAlarmDevices}
        settings={fireAlarmSettings}
        walls={walls}
        scaleIsSet={scaleIsSet}
        planPxPerMeter={planPxPerMeter}
        selectedFireAlarmDeviceId={selectedFireAlarmDeviceId}
        nodeRegistry={coneLiveHandles}
        wallClearancePx={wallClearancePx}
        maxClipRadiusPx={maxClipRadiusPx}
      />
    </CameraFovConesLayer>
  )
}
