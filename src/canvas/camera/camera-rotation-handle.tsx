import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle } from 'react-konva'
import { bearingDegBetweenPoints, pointAtBearing } from '../../domain/shared/fov-cone-sector-geometry'
import { ROTATION_HANDLE_DISTANCE_PX, ROTATION_HANDLE_RADIUS_PX } from '../shared/brand-and-dori-color-palette'

interface CameraRotationHandleProps {
  rotationDeg: number
  /** Current stage zoom - handle size/distance are divided by this so it reads as a constant screen size at any zoom (never exported, unlike the icon). */
  viewportScale: number
  /** Called on every drag step with the live bearing, for the cone to follow with no store write yet. */
  onRotateLive: (rotationDeg: number) => void
  onRotateEnd: (rotationDeg: number) => void
}

/**
 * Small handle, a fixed distance from the camera centre along its current
 * bearing. Rendered as a child of the camera's marker `Group`, so its own
 * drag coordinates are already relative to the camera centre (local
 * origin 0,0) - exactly what `bearingDegBetweenPoints`/`pointAtBearing`
 * expect. Dragging recomputes the bearing from the pointer each step and
 * pins the handle back onto the fixed-radius circle (so it slides around
 * the camera rather than flying off toward the pointer).
 */
export function CameraRotationHandle({ rotationDeg, viewportScale, onRotateLive, onRotateEnd }: CameraRotationHandleProps) {
  const distancePx = ROTATION_HANDLE_DISTANCE_PX / viewportScale
  const handlePos = pointAtBearing(0, 0, rotationDeg, distancePx)

  const bearingFromPointer = (e: KonvaEventObject<DragEvent>): number | null => {
    const parent = e.target.getParent()
    const pointer = parent?.getRelativePointerPosition()
    if (!pointer) return null
    return bearingDegBetweenPoints(0, 0, pointer.x, pointer.y)
  }

  return (
    <Circle
      x={handlePos.x}
      y={handlePos.y}
      radius={ROTATION_HANDLE_RADIUS_PX / viewportScale}
      fill="#2563eb"
      stroke="#ffffff"
      strokeWidth={1.5 / viewportScale}
      draggable
      onDragMove={(e) => {
        const bearing = bearingFromPointer(e)
        if (bearing === null) return
        e.target.position(pointAtBearing(0, 0, bearing, distancePx))
        onRotateLive(bearing)
      }}
      onDragEnd={(e) => {
        const bearing = bearingFromPointer(e) ?? rotationDeg
        onRotateEnd(bearing)
      }}
    />
  )
}
