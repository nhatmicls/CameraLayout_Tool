import { memo } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Text } from 'react-konva'
import type { FormFactor } from '../catalog/camera-catalog-schema'
import type { PlacedCamera } from '../domain/project-types'
import { CameraFormFactorIconShape } from './camera-form-factor-icon-shape'
import { CameraRotationHandle } from './camera-rotation-handle'
import { SELECTION_RING_PADDING_PX } from './brand-and-dori-color-palette'

interface CameraMarkerNodeProps {
  camera: PlacedCamera
  /** "C{n}", derived by the caller from the camera's position in the placement-order array - not stored on the camera itself. */
  label: string
  formFactor: FormFactor
  tint: string
  iconRadiusPx: number
  selected: boolean
  /** False in export mode: no dragging, no selection ring, no rotation handle - a pure static render (see `plan-scene-layers.tsx`). */
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelect: (id: string) => void
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  onRotateLive: (id: string, rotationDeg: number) => void
  onRotateEnd: (id: string, rotationDeg: number) => void
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * One camera's draggable icon + label (+ selection ring/rotation handle
 * when selected and interactive). Lives in the markers layer, above every
 * camera's cone (see `plan-scene-layers.tsx`) - selection and dragging go
 * through this icon only, never the cone underneath it.
 *
 * Wrapped in `React.memo`: `camera` keeps the same object reference for
 * every camera unaffected by a given store update (see
 * `project-store.ts`'s `updateCamera`), and every other prop here is
 * either a primitive or a stable callback - so moving/rotating/selecting
 * one camera never re-renders the others.
 */
export const CameraMarkerNode = memo(function CameraMarkerNode({
  camera,
  label,
  formFactor,
  tint,
  iconRadiusPx,
  selected,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelect,
  onDragMove,
  onDragEnd,
  onRotateLive,
  onRotateEnd,
}: CameraMarkerNodeProps) {
  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true // don't let it reach the Stage's own "click empty area -> deselect" handler
    onSelect(camera.id)
  }

  return (
    <Group
      x={camera.x}
      y={camera.y}
      draggable={interactive}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragMove={(e) => {
        // Konva drag events bubble: the rotation handle (a draggable child of
        // this Group) would otherwise land here with `e.target` = the handle,
        // whose x/y are local offsets from the camera centre - not a plan
        // position. Only react to drags of this Group itself.
        if (e.target !== e.currentTarget) return
        onDragMove(camera.id, { x: e.target.x(), y: e.target.y() })
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return // bubbled from the rotation handle - see onDragMove
        // Commit-time clamp: cheaper than a dragBoundFunc (which operates in
        // Konva's "absolute"/screen space, not image px) and sufficient to
        // guarantee the stored position stays on the plan.
        const x = clamp(e.target.x(), 0, imageWidthPx)
        const y = clamp(e.target.y(), 0, imageHeightPx)
        e.target.position({ x, y })
        onDragEnd(camera.id, { x, y })
      }}
    >
      <CameraFormFactorIconShape formFactor={formFactor} tint={tint} radiusPx={iconRadiusPx} />

      {selected && (
        <Circle
          radius={iconRadiusPx + SELECTION_RING_PADDING_PX / viewportScale}
          stroke="#2563eb"
          strokeWidth={2 / viewportScale}
          listening={false}
        />
      )}

      <Text
        text={label}
        fontSize={Math.max(12, iconRadiusPx * 0.9)}
        fill="#111827"
        y={iconRadiusPx * 1.3}
        offsetX={label.length * Math.max(12, iconRadiusPx * 0.9) * 0.3}
        listening={false}
      />

      {selected && interactive && (
        <CameraRotationHandle
          rotationDeg={camera.rotationDeg}
          viewportScale={viewportScale}
          onRotateLive={(deg) => onRotateLive(camera.id, deg)}
          onRotateEnd={(deg) => onRotateEnd(camera.id, deg)}
        />
      )}
    </Group>
  )
})
