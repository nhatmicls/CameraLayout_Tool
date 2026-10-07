import { useMemo } from 'react'
import { Image as KonvaImage, Layer } from 'react-konva'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedFireAlarmDevicePatch } from '../../domain/fire-alarm/placed-fire-alarm-device-builder-and-patch'
import type { PlacedCamera, Wall } from '../../domain/project-file/project-types'
import { metersToPlanPx } from '../../domain/shared/scale-calibration-calculator'
import type { PlacedSensor, PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import type { WallNode } from '../../domain/wall/wall-node-editing'
import { WALL_MOUNT_CLEARANCE_M } from '../../domain/wall/wall-segment-geometry'
import { CameraFovConesLayer } from '../camera/camera-fov-cones-layer'
import { FireDetectorCoverageShapes } from '../fire-alarm/fire-detector-coverage-shapes'
import { SensorCoverageShapes } from '../sensor/sensor-coverage-shapes'
import { useConeLiveHandles } from '../camera/use-cone-live-handles'
import { WallSegmentsLayer } from '../wall/wall-segments-layer'
import { computeIconRadiusPx, computeWallStrokeWidthPx } from '../shared/brand-and-dori-color-palette'
import { usePlanSceneCabling, type PlanSceneCabling, type PlanSceneCablingInteraction } from '../cable/use-plan-scene-cabling'
import { PlanSceneMarkersLayer } from './plan-scene-markers-layer'

export interface PlanSceneLayersProps {
  decodedImage: HTMLImageElement
  imageWidthPx: number
  imageHeightPx: number
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
  fireAlarmSettings: FireAlarmSettings
  planPxPerMeter: number
  /** True only with a real scale set - gates fire-detector coverage circles (never drawn against the `planPxPerMeter ?? 1` drawing fallback the caller uses for cameras/sensors). */
  scaleIsSet: boolean
  /** Hubs, cables, cable types + settings and the real scale (null = no over-length styling). */
  cabling: PlanSceneCabling
  /** Hub / cable selection and editing. Omitted (export, dev spike) = hubs and cables are a static render. */
  cablingInteraction?: PlanSceneCablingInteraction
  /** False hides every camera cone, sensor coverage shape and fire-detector coverage circle (the cable tool: routes are drawn on a clear plan). Default true. */
  coverageVisible?: boolean
  /** False strips drag/selection/rotation-handle wiring for a pure static render - the PNG export reuses this component that way. */
  interactive: boolean
  selectedCameraId: string | null
  selectedWallId: string | null
  selectedSensorId: string | null
  selectedFireAlarmDeviceId: string | null
  /** True only in select mode: walls can be clicked. Ignored when `interactive` is false. */
  wallsSelectable: boolean
  /** False while a drawing tool (walls, hubs, cables) is on, so a click on a camera (cameras sit ON walls) reaches the Stage as a tool click instead of grabbing the camera. Ignored when `interactive` is false. */
  markersListening?: boolean
  /** Needed only to size the screen-constant selection ring/rotation handle and wall click target; irrelevant (and unused) when `interactive` is false. */
  viewportScale: number
  onSelectCamera: (id: string | null) => void
  onSelectWall: (id: string) => void
  onSelectSensor: (id: string) => void
  onSelectFireAlarmDevice: (id: string) => void
  onMoveWallNode: (from: WallNode, to: WallNode) => void
  onCameraDragEnd: (id: string, x: number, y: number) => void
  onCameraRotateEnd: (id: string, rotationDeg: number) => void
  /** One commit callback covering a sensor's move, rotate and (for a beam) either end's drag. */
  onSensorCommit: (id: string, patch: PlacedSensorPatch) => void
  onFireAlarmDeviceCommit: (id: string, patch: PlacedFireAlarmDevicePatch) => void
}

/**
 * The single renderer of the plan image + every camera's FOV cone + every
 * sensor's coverage/beam + every fire-detector's coverage circle + the
 * walls + marker icons, parameterised by `interactive`. The PNG export
 * mounts this same component on a detached, non-interactive stage at
 * image-native size instead of duplicating the drawing code.
 *
 * Four layers: image -> cones (camera cones, `SensorCoverageShapes`,
 * `FireDetectorCoverageShapes`, all non-listening) -> walls (lines, cable
 * routes, node handles) -> `PlanSceneMarkersLayer` (every marker kind +
 * hubs + the selected cable's editor). Every icon sits above every wall/
 * cable/cone regardless of placement order. Sensors, fire-alarm devices and
 * cables add zero Konva Layers - the scene stays at Konva's recommended
 * five-Layer maximum (comment in `floor-plan-stage.tsx`).
 */
export function PlanSceneLayers({
  decodedImage,
  imageWidthPx,
  imageHeightPx,
  cameras,
  walls,
  sensors,
  fireAlarmDevices,
  fireAlarmSettings,
  planPxPerMeter,
  scaleIsSet,
  cabling,
  cablingInteraction,
  coverageVisible = true,
  interactive,
  selectedCameraId,
  selectedWallId,
  selectedSensorId,
  selectedFireAlarmDeviceId,
  wallsSelectable,
  markersListening = true,
  viewportScale,
  onSelectCamera,
  onSelectWall,
  onSelectSensor,
  onSelectFireAlarmDevice,
  onMoveWallNode,
  onCameraDragEnd,
  onCameraRotateEnd,
  onSensorCommit,
  onFireAlarmDeviceCommit,
}: PlanSceneLayersProps) {
  const iconRadiusPx = useMemo(() => computeIconRadiusPx(Math.max(imageWidthPx, imageHeightPx)), [imageWidthPx, imageHeightPx])
  const wallClearancePx = useMemo(() => metersToPlanPx(WALL_MOUNT_CLEARANCE_M, planPxPerMeter), [planPxPerMeter])
  const maxClipRadiusPx = useMemo(() => Math.hypot(imageWidthPx, imageHeightPx), [imageWidthPx, imageHeightPx]) // perf cap, image diagonal
  // Shared live-handle registry + drag/rotate wrapper callbacks - see `use-cone-live-handles.ts`.
  const live = useConeLiveHandles(onCameraDragEnd, onCameraRotateEnd, onSensorCommit, onFireAlarmDeviceCommit)
  const { coneLiveHandles } = live
  const cablingInteractionIfInteractive = interactive ? cablingInteraction : undefined
  const {
    index: cableEndpointIndex,
    limitStatusById,
    cableLines,
  } = usePlanSceneCabling({ cameras, sensors, cabling, interaction: cablingInteractionIfInteractive, iconRadiusPx, viewportScale })

  return (
    <>
      <Layer listening={false}>
        <KonvaImage image={decodedImage} width={imageWidthPx} height={imageHeightPx} />
      </Layer>

      <CameraFovConesLayer
        cameras={cameras}
        walls={walls}
        planPxPerMeter={planPxPerMeter}
        selectedCameraId={interactive ? selectedCameraId : null}
        coneLiveHandles={coneLiveHandles}
        visible={coverageVisible}
      >
        <SensorCoverageShapes
          sensors={sensors}
          walls={walls}
          planPxPerMeter={planPxPerMeter}
          selectedSensorId={interactive ? selectedSensorId : null}
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
          selectedFireAlarmDeviceId={interactive ? selectedFireAlarmDeviceId : null}
          nodeRegistry={coneLiveHandles}
          wallClearancePx={wallClearancePx}
          maxClipRadiusPx={maxClipRadiusPx}
        />
      </CameraFovConesLayer>

      <WallSegmentsLayer
        walls={walls}
        strokeWidthPx={computeWallStrokeWidthPx(iconRadiusPx)}
        selectable={interactive && wallsSelectable}
        selectedWallId={interactive ? selectedWallId : null}
        viewportScale={viewportScale}
        onSelectWall={onSelectWall}
        imageWidthPx={imageWidthPx}
        imageHeightPx={imageHeightPx}
        onMoveWallNode={onMoveWallNode}
      >
        {cableLines}
      </WallSegmentsLayer>

      <PlanSceneMarkersLayer
        cameras={cameras}
        sensors={sensors}
        fireAlarmDevices={fireAlarmDevices}
        walls={walls}
        cabling={cabling}
        cablingInteraction={cablingInteractionIfInteractive}
        cableEndpointIndex={cableEndpointIndex}
        limitStatusById={limitStatusById}
        iconRadiusPx={iconRadiusPx}
        planPxPerMeter={planPxPerMeter}
        wallClearancePx={wallClearancePx}
        interactive={interactive}
        listening={interactive && markersListening}
        viewportScale={viewportScale}
        imageWidthPx={imageWidthPx}
        imageHeightPx={imageHeightPx}
        selectedCameraId={selectedCameraId}
        selectedSensorId={interactive ? selectedSensorId : null}
        selectedFireAlarmDeviceId={interactive ? selectedFireAlarmDeviceId : null}
        onSelectCamera={onSelectCamera}
        onSelectSensor={onSelectSensor}
        onSelectFireAlarmDevice={onSelectFireAlarmDevice}
        onSensorCommit={onSensorCommit}
        live={live}
      />
    </>
  )
}
