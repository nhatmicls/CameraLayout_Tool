import { cameraModelById } from '../../catalog/camera/camera-catalog-loader'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import { BRAND_TINTS } from '../shared/brand-and-dori-color-palette'
import { CameraMarkerNode } from './camera-marker-node'

export interface CameraMarkerNodesProps {
  cameras: PlacedCamera[]
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
 * `sensor-marker-nodes.tsx`). Labels are `C{n}` from the camera's position
 * in `cameras[]`. A camera whose catalog model id is unknown is skipped.
 */
export function CameraMarkerNodes({
  cameras,
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
