import { useCallback, useMemo, useRef } from 'react'
import type Konva from 'konva'
import { Image as KonvaImage, Layer } from 'react-konva'
import { cameraModelById } from '../catalog/camera-catalog-loader'
import type { PlacedCamera } from '../domain/project-types'
import { resolveEffectiveHfovDeg } from '../domain/camera-coverage-resolver'
import { CameraFovConeShape } from './camera-fov-cone-shape'
import { CameraMarkerNode } from './camera-marker-node'
import { BRAND_TINTS, computeIconRadiusPx } from './brand-and-dori-color-palette'

export interface PlanSceneLayersProps {
  decodedImage: HTMLImageElement
  imageWidthPx: number
  imageHeightPx: number
  cameras: PlacedCamera[]
  planPxPerMeter: number
  /** False strips drag/selection/rotation-handle wiring for a pure static render - phase 7's export reuses this component that way. */
  interactive: boolean
  selectedCameraId: string | null
  /** Needed only to size the screen-constant selection ring/rotation handle; irrelevant (and unused) when `interactive` is false. */
  viewportScale: number
  onSelectCamera: (id: string | null) => void
  onCameraDragEnd: (id: string, x: number, y: number) => void
  onCameraRotateEnd: (id: string, rotationDeg: number) => void
}

/**
 * The single renderer of the plan image + every camera's FOV cone + marker
 * icon, parameterised by `interactive`. Phase 7 (PNG export) mounts this
 * same component on a detached, non-interactive stage at image-native size
 * instead of duplicating the drawing code.
 *
 * Three layers, in paint order: image (non-listening) -> cones
 * (non-listening, so clicks always pass through to the icon below) ->
 * markers (listening only when interactive). This keeps every icon above
 * every cone regardless of placement order.
 */
export function PlanSceneLayers({
  decodedImage,
  imageWidthPx,
  imageHeightPx,
  cameras,
  planPxPerMeter,
  interactive,
  selectedCameraId,
  viewportScale,
  onSelectCamera,
  onCameraDragEnd,
  onCameraRotateEnd,
}: PlanSceneLayersProps) {
  // Lets a marker's drag/rotate move its cone directly (imperative Konva
  // calls, no React state) - see camera-fov-cone-shape.tsx's registration
  // effect and the handlers below. Zero store writes and zero re-renders
  // of any camera happen mid-gesture; only the single dragend/rotateend
  // commit touches the store.
  const coneNodeRegistry = useRef(new Map<string, Konva.Group | null>())

  const iconRadiusPx = useMemo(() => computeIconRadiusPx(Math.max(imageWidthPx, imageHeightPx)), [imageWidthPx, imageHeightPx])

  const handleCameraDragMove = useCallback((id: string, pos: { x: number; y: number }) => {
    coneNodeRegistry.current.get(id)?.position(pos)
  }, [])

  const handleCameraDragEnd = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      coneNodeRegistry.current.get(id)?.position(pos)
      onCameraDragEnd(id, pos.x, pos.y)
    },
    [onCameraDragEnd],
  )

  const handleCameraRotateLive = useCallback((id: string, rotationDeg: number) => {
    coneNodeRegistry.current.get(id)?.rotation(rotationDeg)
  }, [])

  const handleCameraRotateEnd = useCallback(
    (id: string, rotationDeg: number) => {
      coneNodeRegistry.current.get(id)?.rotation(rotationDeg)
      onCameraRotateEnd(id, rotationDeg)
    },
    [onCameraRotateEnd],
  )

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
    <>
      <Layer listening={false}>
        <KonvaImage image={decodedImage} width={imageWidthPx} height={imageHeightPx} />
      </Layer>

      <Layer listening={false}>
        {conesInPaintOrder.map((camera) => {
          const model = cameraModelById(camera.modelId)
          if (!model) return null // unknown/removed catalog id - skip rather than crash the scene
          return (
            <CameraFovConeShape
              key={camera.id}
              cameraId={camera.id}
              nodeRegistry={coneNodeRegistry}
              x={camera.x}
              y={camera.y}
              rotationDeg={camera.rotationDeg}
              pixelWidth={model.pixelWidth}
              hfovDeg={resolveEffectiveHfovDeg(model.lens, camera.hfovDeg)}
              rangeM={camera.rangeM}
              planPxPerMeter={planPxPerMeter}
              selected={interactive && camera.id === selectedCameraId}
            />
          )
        })}
      </Layer>

      <Layer listening={interactive}>
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
