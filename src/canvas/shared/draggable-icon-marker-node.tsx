import { memo, type ReactNode } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Text } from 'react-konva'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { CameraRotationHandle } from '../camera/camera-rotation-handle'
import { SELECTION_RING_PADDING_PX } from './brand-and-dori-color-palette'

export interface DraggableIconMarkerNodeItem {
  id: string
  x: number
  y: number
}

interface DraggableIconMarkerNodeProps {
  item: DraggableIconMarkerNodeItem
  /** The kind-specific glyph (e.g. `SensorKindIconShape`/`FireAlarmKindIconShape`), rendered at the marker's local origin. */
  icon: ReactNode
  /** "S{n}"/"F{n}", derived by the caller from the item's position in its own placed-items array. */
  label: string
  iconRadiusPx: number
  selected: boolean
  /** Current bearing, degrees - only read while `rotatable` is true. */
  rotationDeg?: number
  /** Shows the rotation handle when selected + interactive. Default false: most marker kinds (fire-alarm devices, circle sensors) never rotate. */
  rotatable?: boolean
  /** False in export mode: no dragging, no selection ring, no rotation handle - a pure static render (see `plan-scene-layers.tsx`). */
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelect: (id: string) => void
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  onRotateLive?: (id: string, rotationDeg: number) => void
  onRotateEnd?: (id: string, rotationDeg: number) => void
}

/**
 * One draggable icon + label (+ selection ring, + rotation handle when
 * selected/interactive/rotatable) - the generic marker shared by every
 * placed-item kind that is "an icon you can drag and optionally rotate"
 * (sensor, fire-alarm device; cameras keep their own `CameraMarkerNode`
 * since a camera's rotation handle is unconditional, not a prop). Extracted
 * out of the sensor-only `sensor-marker-node.tsx` (pure generalisation -
 * sensor markers render identically through `sensor-marker-nodes.tsx`'s call
 * site) so `fire-alarm-marker-nodes.tsx` reuses this instead of copying it.
 * Same click-select with `cancelBubble`, same `e.target === e.currentTarget`
 * drag-bubble guard (the rotation handle is a draggable child of this
 * Group), same commit-time clamp to the image as `camera-marker-node.tsx`.
 */
export const DraggableIconMarkerNode = memo(function DraggableIconMarkerNode({
  item,
  icon,
  label,
  iconRadiusPx,
  selected,
  rotationDeg = 0,
  rotatable = false,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelect,
  onDragMove,
  onDragEnd,
  onRotateLive,
  onRotateEnd,
}: DraggableIconMarkerNodeProps) {
  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true // don't let it reach the Stage's own "click empty area -> deselect" handler
    onSelect(item.id)
  }

  return (
    <Group
      x={item.x}
      y={item.y}
      draggable={interactive}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragMove={(e) => {
        if (e.target !== e.currentTarget) return // bubbled from the rotation handle
        onDragMove(item.id, { x: e.target.x(), y: e.target.y() })
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return
        const clamped = clampPointToImageBounds({ x: e.target.x(), y: e.target.y() }, imageWidthPx, imageHeightPx)
        e.target.position(clamped)
        onDragEnd(item.id, clamped)
      }}
    >
      {icon}

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

      {selected && interactive && rotatable && onRotateLive && onRotateEnd && (
        <CameraRotationHandle
          rotationDeg={rotationDeg}
          viewportScale={viewportScale}
          onRotateLive={(deg) => onRotateLive(item.id, deg)}
          onRotateEnd={(deg) => onRotateEnd(item.id, deg)}
        />
      )}
    </Group>
  )
})
