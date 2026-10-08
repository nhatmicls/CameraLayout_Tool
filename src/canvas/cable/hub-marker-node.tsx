import { memo } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import type { Hub } from '../../domain/cable/cable-layout-types'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { SELECTION_RING_PADDING_PX } from '../shared/brand-and-dori-color-palette'
import { HUB_FILL_COLOR } from './cable-type-color-palette'

interface HubMarkerNodeProps {
  hub: Hub
  /** "H{n}" / "R{n}" / "D{n}", from the hub's position in the hub array - not stored on the hub. */
  label: string
  iconRadiusPx: number
  selected: boolean
  /** False in the PNG export: no dragging, no selection ring. */
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelect?: (id: string) => void
  onDragEnd?: (id: string, x: number, y: number) => void
}

/**
 * One hub: a dark square with its label underneath, draggable when
 * interactive. A riser (cables go up to the floor above) carries a white
 * up arrow, a drop (down to the floor below) a down arrow. Lives in the markers Layer, above every wall and cable. Its
 * cables are redrawn when the drag is dropped (the store write), not while
 * dragging.
 */
export const HubMarkerNode = memo(function HubMarkerNode({
  hub,
  label,
  iconRadiusPx,
  selected,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelect,
  onDragEnd,
}: HubMarkerNodeProps) {
  const side = iconRadiusPx * 1.6
  const fontSize = Math.max(12, iconRadiusPx * 0.9)
  const ringSide = side + (2 * SELECTION_RING_PADDING_PX) / viewportScale

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true // not a click on empty canvas (which would deselect)
    onSelect?.(hub.id)
  }

  return (
    <Group
      x={hub.x}
      y={hub.y}
      draggable={interactive}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return // Konva drag events bubble
        const clamped = clampPointToImageBounds({ x: e.target.x(), y: e.target.y() }, imageWidthPx, imageHeightPx)
        e.target.position(clamped)
        onDragEnd?.(hub.id, clamped.x, clamped.y)
      }}
    >
      <Rect
        x={-side / 2}
        y={-side / 2}
        width={side}
        height={side}
        cornerRadius={side * 0.15}
        fill={HUB_FILL_COLOR}
        stroke="#ffffff"
        strokeWidth={Math.max(1, iconRadiusPx * 0.1)}
      />
      {(hub.kind === 'riser' || hub.kind === 'drop') && (
        <Line
          // Up arrow (the vertical stroke, then the two head strokes); flipped for a drop.
          points={[0, side * 0.3, 0, -side * 0.3, -side * 0.22, -side * 0.06, 0, -side * 0.3, side * 0.22, -side * 0.06]}
          scaleY={hub.kind === 'drop' ? -1 : 1}
          stroke="#ffffff"
          strokeWidth={Math.max(1.5, side * 0.1)}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {hub.kind === 'shaft' && (
        // A ring, standing in for the tube's cross-section - distinct from the riser/drop arrows.
        <Circle radius={side * 0.25} stroke="#ffffff" strokeWidth={Math.max(1.5, side * 0.12)} listening={false} />
      )}

      {selected && (
        <Rect
          x={-ringSide / 2}
          y={-ringSide / 2}
          width={ringSide}
          height={ringSide}
          stroke="#2563eb"
          strokeWidth={2 / viewportScale}
          listening={false}
        />
      )}

      <Text
        text={label}
        fontSize={fontSize}
        fill="#111827"
        y={iconRadiusPx * 1.3}
        offsetX={label.length * fontSize * 0.3}
        listening={false}
      />
    </Group>
  )
})
