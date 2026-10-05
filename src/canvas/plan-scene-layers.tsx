import { useCallback, useMemo, useRef } from 'react'
import { Image as KonvaImage, Layer } from 'react-konva'
import { cameraModelById } from '../catalog/camera-catalog-loader'
import type { PlacedCamera, Wall } from '../domain/project-types'
import type { WallNode } from '../domain/wall-node-editing'
import { CameraFovConesLayer } from './camera-fov-cones-layer'
import { CameraMarkerNode } from './camera-marker-node'
import { WallSegmentsLayer } from './wall-segments-layer'
import type { ConeLiveHandle } from './wall-occlusion-cone-clip'
import { BRAND_TINTS, computeIconRadiusPx, computeWallStrokeWidthPx } from './brand-and-dori-color-palette'

export interface PlanSceneLayersProps {
  decodedImage: HTMLImageElement
  imageWidthPx: number
  imageHeightPx: number
  cameras: PlacedCamera[]
  walls: Wall[]
  planPxPerMeter: number
  /** False strips drag/selection/rotation-handle wiring for a pure static render - phase 7's export reuses this component that way. */
  interactive: boolean
  selectedCameraId: string | null
  selectedWallId: string | null
  /** True only in select mode: walls can be clicked. Ignored when `interactive` is false. */
  wallsSelectable: boolean
  /** False while drawing walls, so a click on a camera (cameras sit ON walls) places a wall point instead of grabbing the camera. Ignored when `interactive` is false. */
  markersListening?: boolean
  /** Needed only to size the screen-constant selection ring/rotation handle and wall click target; irrelevant (and unused) when `interactive` is false. */
  viewportScale: number
  onSelectCamera: (id: string | null) => void
  onSelectWall: (id: string) => void
  onMoveWallNode: (from: WallNode, to: WallNode) => void
  onCameraDragEnd: (id: string, x: number, y: number) => void
  onCameraRotateEnd: (id: string, rotationDeg: number) => void
}

/**
 * The single renderer of the plan image + every camera's FOV cone + the
 * walls + marker icons, parameterised by `interactive`. Phase 7 (PNG export)
 * mounts this same component on a detached, non-interactive stage at
 * image-native size instead of duplicating the drawing code.
 *
 * Four layers, in paint order: image (non-listening) -> cones
 * (non-listening, so clicks always pass through to what is above) -> walls
 * -> markers (listening only when interactive). Every icon is above every
 * wall and every cone regardless of placement order, so a camera on a wall
 * wins the click.
 */
export function PlanSceneLayers({
  decodedImage,
  imageWidthPx,
  imageHeightPx,
  cameras,
  walls,
  planPxPerMeter,
  interactive,
  selectedCameraId,
  selectedWallId,
  wallsSelectable,
  markersListening = true,
  viewportScale,
  onSelectCamera,
  onSelectWall,
  onMoveWallNode,
  onCameraDragEnd,
  onCameraRotateEnd,
}: PlanSceneLayersProps) {
  // Lets a marker's drag/rotate move (and re-clip) its cone directly
  // (imperative Konva calls, no React state) - see
  // camera-fov-cone-shape.tsx's registration effect and the handlers below.
  // Zero store writes and zero re-renders of any camera happen
  // mid-gesture; only the single dragend/rotateend commit touches the store.
  const coneLiveHandles = useRef(new Map<string, ConeLiveHandle>())

  const iconRadiusPx = useMemo(() => computeIconRadiusPx(Math.max(imageWidthPx, imageHeightPx)), [imageWidthPx, imageHeightPx])

  const handleCameraDragMove = useCallback((id: string, pos: { x: number; y: number }) => {
    coneLiveHandles.current.get(id)?.moveTo(pos)
  }, [])

  const handleCameraDragEnd = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      coneLiveHandles.current.get(id)?.moveTo(pos)
      onCameraDragEnd(id, pos.x, pos.y)
    },
    [onCameraDragEnd],
  )

  const handleCameraRotateLive = useCallback((id: string, rotationDeg: number) => {
    coneLiveHandles.current.get(id)?.rotateTo(rotationDeg)
  }, [])

  const handleCameraRotateEnd = useCallback(
    (id: string, rotationDeg: number) => {
      coneLiveHandles.current.get(id)?.rotateTo(rotationDeg)
      onCameraRotateEnd(id, rotationDeg)
    },
    [onCameraRotateEnd],
  )

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
      />

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
      </Layer>
    </>
  )
}
