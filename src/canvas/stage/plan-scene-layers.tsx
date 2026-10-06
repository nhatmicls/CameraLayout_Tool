import { useMemo } from 'react'
import { Image as KonvaImage, Layer } from 'react-konva'
import { cameraModelById } from '../../catalog/camera/camera-catalog-loader'
import type { PlacedCamera, Wall } from '../../domain/project-file/project-types'
import { metersToPlanPx } from '../../domain/shared/scale-calibration-calculator'
import type { PlacedSensor, PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import type { WallNode } from '../../domain/wall/wall-node-editing'
import { WALL_MOUNT_CLEARANCE_M } from '../../domain/wall/wall-segment-geometry'
import { CameraFovConesLayer } from '../camera/camera-fov-cones-layer'
import { CameraMarkerNode } from '../camera/camera-marker-node'
import { SensorCoverageShapes } from '../sensor/sensor-coverage-shapes'
import { SensorMarkerNodes } from '../sensor/sensor-marker-nodes'
import { useConeLiveHandles } from '../camera/use-cone-live-handles'
import { WallSegmentsLayer } from '../wall/wall-segments-layer'
import { BRAND_TINTS, computeIconRadiusPx, computeWallStrokeWidthPx } from '../shared/brand-and-dori-color-palette'

export interface PlanSceneLayersProps {
  decodedImage: HTMLImageElement
  imageWidthPx: number
  imageHeightPx: number
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  planPxPerMeter: number
  /** False strips drag/selection/rotation-handle wiring for a pure static render - the PNG export reuses this component that way. */
  interactive: boolean
  selectedCameraId: string | null
  selectedWallId: string | null
  selectedSensorId: string | null
  /** True only in select mode: walls can be clicked. Ignored when `interactive` is false. */
  wallsSelectable: boolean
  /** False while drawing walls, so a click on a camera (cameras sit ON walls) places a wall point instead of grabbing the camera. Ignored when `interactive` is false. */
  markersListening?: boolean
  /** Needed only to size the screen-constant selection ring/rotation handle and wall click target; irrelevant (and unused) when `interactive` is false. */
  viewportScale: number
  onSelectCamera: (id: string | null) => void
  onSelectWall: (id: string) => void
  onSelectSensor: (id: string) => void
  onMoveWallNode: (from: WallNode, to: WallNode) => void
  onCameraDragEnd: (id: string, x: number, y: number) => void
  onCameraRotateEnd: (id: string, rotationDeg: number) => void
  /** One commit callback covering a sensor's move, rotate and (for a beam) either end's drag. */
  onSensorCommit: (id: string, patch: PlacedSensorPatch) => void
}

/**
 * The single renderer of the plan image + every camera's FOV cone + every
 * sensor's coverage/beam + the walls + marker icons, parameterised by
 * `interactive`. The PNG export mounts this same component on a detached,
 * non-interactive stage at image-native size instead of duplicating the
 * drawing code.
 *
 * Four layers, in paint order: image (non-listening) -> cones (camera FOV
 * cones, then `SensorCoverageShapes` - both non-listening, so clicks always
 * pass through to what is above) -> walls -> markers (camera markers, then
 * `SensorMarkerNodes`/beams; listening only when interactive). Every icon is
 * above every wall and every cone/coverage shape regardless of placement
 * order, so a camera or sensor on a wall wins the click. Sensors add zero
 * Konva Layers: their coverage lives inside the cones Layer via
 * `CameraFovConesLayer`'s `children`, their markers inside this same markers
 * Layer - the scene stays at Konva's recommended five-Layer maximum
 * (comment in `floor-plan-stage.tsx`).
 */
export function PlanSceneLayers({
  decodedImage,
  imageWidthPx,
  imageHeightPx,
  cameras,
  walls,
  sensors,
  planPxPerMeter,
  interactive,
  selectedCameraId,
  selectedWallId,
  selectedSensorId,
  wallsSelectable,
  markersListening = true,
  viewportScale,
  onSelectCamera,
  onSelectWall,
  onSelectSensor,
  onMoveWallNode,
  onCameraDragEnd,
  onCameraRotateEnd,
  onSensorCommit,
}: PlanSceneLayersProps) {
  const iconRadiusPx = useMemo(() => computeIconRadiusPx(Math.max(imageWidthPx, imageHeightPx)), [imageWidthPx, imageHeightPx])
  const wallClearancePx = useMemo(() => metersToPlanPx(WALL_MOUNT_CLEARANCE_M, planPxPerMeter), [planPxPerMeter])
  // Perf: no wall can be farther than this from anything else on the image.
  const maxClipRadiusPx = useMemo(() => Math.hypot(imageWidthPx, imageHeightPx), [imageWidthPx, imageHeightPx])

  // Shared camera+sensor live-handle registry and its eight drag/rotate
  // wrapper callbacks - see `use-cone-live-handles.ts`.
  const {
    coneLiveHandles,
    handleCameraDragMove,
    handleCameraDragEnd,
    handleCameraRotateLive,
    handleCameraRotateEnd,
    handleSensorDragMove,
    handleSensorDragEnd,
    handleSensorRotateLive,
    handleSensorRotateEnd,
  } = useConeLiveHandles(onCameraDragEnd, onCameraRotateEnd, onSensorCommit)

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
      />

      <Layer listening={interactive && markersListening}>
        {cameras.map((camera, index) => {
          const model = cameraModelById(camera.modelId)
          if (!model) return null
          return (
            <CameraMarkerNode
              key={camera.id}
              camera={camera}
              label={`C${index + 1}`}
              formFactor={model.formFactor}
              tint={BRAND_TINTS[model.brand]}
              iconRadiusPx={iconRadiusPx}
              selected={interactive && camera.id === selectedCameraId}
              interactive={interactive}
              viewportScale={viewportScale}
              imageWidthPx={imageWidthPx}
              imageHeightPx={imageHeightPx}
              onSelect={onSelectCamera}
              onDragMove={handleCameraDragMove}
              onDragEnd={handleCameraDragEnd}
              onRotateLive={handleCameraRotateLive}
              onRotateEnd={handleCameraRotateEnd}
            />
          )
        })}

        <SensorMarkerNodes
          sensors={sensors}
          walls={walls}
          iconRadiusPx={iconRadiusPx}
          planPxPerMeter={planPxPerMeter}
          selectedSensorId={interactive ? selectedSensorId : null}
          interactive={interactive}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          wallClearancePx={wallClearancePx}
          onSelectSensor={onSelectSensor}
          onDragMove={handleSensorDragMove}
          onDragEnd={handleSensorDragEnd}
          onRotateLive={handleSensorRotateLive}
          onRotateEnd={handleSensorRotateEnd}
          onCommit={onSensorCommit}
        />
      </Layer>
    </>
  )
}
