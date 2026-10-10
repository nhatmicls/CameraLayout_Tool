import { cameraModelById } from '../../catalog/camera/camera-catalog-loader'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import { BRAND_TINTS } from '../shared/brand-and-dori-color-palette'
import { CameraMarkerNode } from './camera-marker-node'

export interface CameraMarkerNodesProps {
  cameras: PlacedCamera[]
  /** Index-aligned with `cameras`, from the shared allocator (`floor-item-label-allocator.ts`) - the one source for every label on the floor. */
  labels: readonly string[]
  /** Cameras whose marker the view config hides. Skipped by id - the array is never filtered, so labels do not renumber. */
  hiddenIds?: ReadonlySet<string>
  iconRadiusPx: number
  selectedCameraId: string | null
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelectCamera: (id: string) => void
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  onRotateLive: (id: string, rotationDeg: number) => void
  onRotateEnd: (id: string, rotationDeg: number) => void
}

/**
 * Markers for every placed camera, in `cameras[]` order (the camera twin of
 * `sensor-marker-nodes.tsx`). Labels come from `labels` (index-aligned with
 * `cameras`) - the shared allocator, never computed here. A camera whose
 * catalog model id is unknown is skipped.
 */
export function CameraMarkerNodes({
  cameras,
  labels,
  hiddenIds,
  iconRadiusPx,
  selectedCameraId,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelectCamera,
  onDragMove,
  onDragEnd,
  onRotateLive,
  onRotateEnd,
}: CameraMarkerNodesProps) {
  return (
    <>
      {cameras.map((camera, index) => {
        const model = cameraModelById(camera.modelId)
        if (!model || hiddenIds?.has(camera.id)) return null
        return (
          <CameraMarkerNode
            key={camera.id}
            camera={camera}
            label={labels[index]}
            formFactor={model.formFactor}
            tint={BRAND_TINTS[model.brand]}
            iconRadiusPx={iconRadiusPx}
            selected={interactive && camera.id === selectedCameraId}
            interactive={interactive}
            viewportScale={viewportScale}
            imageWidthPx={imageWidthPx}
            imageHeightPx={imageHeightPx}
            onSelect={onSelectCamera}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onRotateLive={onRotateLive}
            onRotateEnd={onRotateEnd}
          />
        )
      })}
    </>
  )
}
