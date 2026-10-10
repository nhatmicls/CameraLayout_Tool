import { useMemo } from 'react'
import { Layer } from 'react-konva'
import type { ConeLiveHandlers } from '../camera/use-cone-live-handles'
import { CameraMarkerNodes } from '../camera/camera-marker-nodes'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
import type { PlacedCamera, Wall } from '../../domain/project-file/project-types'
import type { PlacedSensor, PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { FireAlarmMarkerNodes } from '../fire-alarm/fire-alarm-marker-nodes'
import { SensorMarkerNodes } from '../sensor/sensor-marker-nodes'
import { HubAndSelectedCableNodes } from '../cable/hub-and-selected-cable-nodes'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from '../cable/use-plan-scene-cabling'
import type { CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'

export interface PlanSceneMarkersLayerProps {
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
  walls: Wall[]
  /** View config (`use-plan-scene-view-visibility.ts`): camera / sensor markers skipped by id, hub markers and the selected cable's editor switched off as a whole. */
  hiddenCameraIds: ReadonlySet<string>
  hiddenSensorIds: ReadonlySet<string>
  hubsVisible: boolean
  cablesVisible: boolean
  /** False while the trunk-drawing tool is active for the selected hub (see `hub-and-selected-cable-nodes.tsx`). Default true. */
  trunkEditingEnabled?: boolean
  cabling: PlanSceneCabling
  cablingInteraction: PlanSceneCablingInteraction | undefined
  cableEndpointIndex: CableEndpointIndex
  limitStatusById: ReadonlyMap<string, CableLimitStatus>
  iconRadiusPx: number
  planPxPerMeter: number
  wallClearancePx: number
  interactive: boolean
  listening: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  selectedCameraId: string | null
  selectedSensorId: string | null
  selectedFireAlarmDeviceId: string | null
  onSelectCamera: (id: string | null) => void
  onSelectSensor: (id: string) => void
  onSelectFireAlarmDevice: (id: string) => void
  onSensorCommit: (id: string, patch: PlacedSensorPatch) => void
  /** The shared camera/sensor/fire-alarm-device drag/rotate live-handle callbacks (`use-cone-live-handles.ts`), passed as one bundle instead of eleven separate props. */
  live: ConeLiveHandlers
}

/**
 * The markers Layer's full contents, pulled out of `plan-scene-layers.tsx`
 * (pure move) to keep that file under the project's line-count guideline
 * once it also had to wire fire-alarm markers. Paint order top-to-bottom:
 * camera markers, sensor markers/beams, fire-alarm device markers, hubs,
 * then the selected cable's editor - every icon sits above every wall/cable/
 * cone regardless of placement order (see `plan-scene-layers.tsx`'s own
 * docstring), so a device on a wall still wins the click.
 */
export function PlanSceneMarkersLayer({
  cameras,
  sensors,
  fireAlarmDevices,
  walls,
  hiddenCameraIds,
  hiddenSensorIds,
  hubsVisible,
  cablesVisible,
  trunkEditingEnabled = true,
  cabling,
  cablingInteraction,
  cableEndpointIndex,
  limitStatusById,
  iconRadiusPx,
  planPxPerMeter,
  wallClearancePx,
  interactive,
  listening,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  selectedCameraId,
  selectedSensorId,
  selectedFireAlarmDeviceId,
  onSelectCamera,
  onSelectSensor,
  onSelectFireAlarmDevice,
  onSensorCommit,
  live,
}: PlanSceneMarkersLayerProps) {
  // ONE allocator call for every marker label on this floor (`floor-item-label-allocator.ts`) -
  // cameras, sensors, fire-alarm devices and hubs/risers/drops share their numbering, so no
  // marker component may count its own array any more. `cableEndpointIndex` already carries the
  // SAME hub labels (it goes through the same allocator) - only the device-kind labels are needed
  // here.
  const itemLabels = useMemo(
    () => buildFloorItemLabels({ cameras, sensors, fireAlarmDevices, hubs: cabling.hubs }, { shaftIds: cabling.shaftIds, fireAlarmModelById: fireAlarmModelSpecById }),
    [cameras, sensors, fireAlarmDevices, cabling.hubs, cabling.shaftIds],
  )

  return (
    <Layer listening={listening}>
      {/* Device markers are children so they paint above the selected cable / trunk editor and below the hub markers. */}
      <HubAndSelectedCableNodes
        cabling={cabling}
        index={cableEndpointIndex}
        limitStatusById={limitStatusById}
        interaction={cablingInteraction}
        hubsVisible={hubsVisible}
        cablesVisible={cablesVisible}
        trunkEditingEnabled={trunkEditingEnabled}
        iconRadiusPx={iconRadiusPx}
        viewportScale={viewportScale}
        imageWidthPx={imageWidthPx}
        imageHeightPx={imageHeightPx}
      >
        <CameraMarkerNodes
          cameras={cameras}
          labels={itemLabels.cameras}
          hiddenIds={hiddenCameraIds}
          iconRadiusPx={iconRadiusPx}
          selectedCameraId={selectedCameraId}
          interactive={interactive}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onSelectCamera={onSelectCamera}
          onDragMove={live.handleCameraDragMove}
          onDragEnd={live.handleCameraDragEnd}
          onRotateLive={live.handleCameraRotateLive}
          onRotateEnd={live.handleCameraRotateEnd}
        />

        <SensorMarkerNodes
          sensors={sensors}
          labels={itemLabels.sensors}
          hiddenIds={hiddenSensorIds}
          walls={walls}
          iconRadiusPx={iconRadiusPx}
          planPxPerMeter={planPxPerMeter}
          selectedSensorId={selectedSensorId}
          interactive={interactive}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          wallClearancePx={wallClearancePx}
          onSelectSensor={onSelectSensor}
          onDragMove={live.handleSensorDragMove}
          onDragEnd={live.handleSensorDragEnd}
          onRotateLive={live.handleSensorRotateLive}
          onRotateEnd={live.handleSensorRotateEnd}
          onCommit={onSensorCommit}
        />

        <FireAlarmMarkerNodes
          devices={fireAlarmDevices}
          labels={itemLabels.fireAlarmDevices}
          iconRadiusPx={iconRadiusPx}
          selectedFireAlarmDeviceId={selectedFireAlarmDeviceId}
          interactive={interactive}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onSelectFireAlarmDevice={onSelectFireAlarmDevice}
          onDragMove={live.handleFireAlarmDeviceDragMove}
          onDragEnd={live.handleFireAlarmDeviceDragEnd}
        />
      </HubAndSelectedCableNodes>
    </Layer>
  )
}
