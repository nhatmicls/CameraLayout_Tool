import { useMemo, type ReactNode, type RefObject } from 'react'
import { Layer } from 'react-konva'
import { cameraModelById } from '../../catalog/camera/camera-catalog-loader'
import { resolveEffectiveHfovDeg, resolveEffectiveVfovDeg } from '../../domain/camera/camera-coverage-resolver'
import type { PlacedCamera, Wall } from '../../domain/project-file/project-types'
import { metersToPlanPx } from '../../domain/shared/scale-calibration-calculator'
import { WALL_MOUNT_CLEARANCE_M, selectOpaqueWallSegments } from '../../domain/wall/wall-segment-geometry'
import { CameraFovConeShape } from './camera-fov-cone-shape'
import type { ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'

export interface CameraFovConesLayerProps {
  cameras: PlacedCamera[]
  walls: Wall[]
  planPxPerMeter: number
  /** Null (or an unknown id) = no cone is highlighted or raised. */
  selectedCameraId: string | null
  /** Filled by each cone; `plan-scene-layers.tsx` drives it from the marker drag / rotate callbacks. */
  coneLiveHandles: RefObject<Map<string, ConeLiveHandle>>
  /** False hides the whole Layer (camera cones and the sensor coverage in `children`) - the cable tool does this so routes are drawn on a clear plan. Default true. */
  visible?: boolean
  /** Rendered inside this Layer, after every camera cone - `plan-scene-layers.tsx` passes `SensorCoverageShapes` here so sensor coverage costs zero extra Konva Layers (phase-05 layer-budget constraint). */
  children?: ReactNode
}

/**
 * The cones layer: one `CameraFovConeShape` per camera, non-listening so
 * clicks always reach the marker icons. Owns the two things every cone
 * shares for wall occlusion - the opaque-wall list (memoised, so its
 * identity only changes when a wall does) and the mounting clearance in px.
 */
export function CameraFovConesLayer({
  cameras,
  walls,
  planPxPerMeter,
  selectedCameraId,
  coneLiveHandles,
  visible = true,
  children,
}: CameraFovConesLayerProps) {
  const opaqueWalls = useMemo(() => selectOpaqueWallSegments(walls), [walls])
  const wallClearancePx = metersToPlanPx(WALL_MOUNT_CLEARANCE_M, planPxPerMeter)

  // Draw the selected camera's cone last (on top) so overlapping alpha
  // bands don't visually bury it - marker order/labels stay in creation
  // (placement) order regardless.
  const conesInPaintOrder = useMemo(() => {
    if (!selectedCameraId) return cameras
    const rest = cameras.filter((c) => c.id !== selectedCameraId)
    const selected = cameras.find((c) => c.id === selectedCameraId)
    return selected ? [...rest, selected] : cameras
  }, [cameras, selectedCameraId])

  return (
    <Layer listening={false} visible={visible}>
      {conesInPaintOrder.map((camera) => {
        const model = cameraModelById(camera.modelId)
        if (!model) return null // unknown/removed catalog id - skip rather than crash the scene
        const hfovDeg = resolveEffectiveHfovDeg(model.lens, camera.hfovDeg)
        const vfov = resolveEffectiveVfovDeg(model.lens, model.pixelWidth, model.pixelHeight, hfovDeg)
        return (
          <CameraFovConeShape
            key={camera.id}
            cameraId={camera.id}
            nodeRegistry={coneLiveHandles}
            x={camera.x}
            y={camera.y}
            rotationDeg={camera.rotationDeg}
            pixelWidth={model.pixelWidth}
            hfovDeg={hfovDeg}
            rangeM={camera.rangeM}
            mountHeightM={camera.mountHeightM}
            tiltDeg={camera.tiltDeg}
            vfovDeg={vfov?.vfovDeg ?? null}
            planPxPerMeter={planPxPerMeter}
            selected={camera.id === selectedCameraId}
            opaqueWalls={opaqueWalls}
            wallClearancePx={wallClearancePx}
          />
        )
      })}
      {children}
    </Layer>
  )
}
