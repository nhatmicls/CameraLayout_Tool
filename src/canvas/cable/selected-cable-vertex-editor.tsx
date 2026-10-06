import { useState } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Line } from 'react-konva'
import { resolveCablePathPx, type CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import { MAX_CABLE_POINTS, type Cable, type CablePoint } from '../../domain/cable/cable-layout-types'
import { insertCablePointOnNearestSegment, moveCablePoint, removeCablePoint } from '../../domain/cable/cable-polyline-editing'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { WALL_SELECTED_COLOR } from '../shared/brand-and-dori-color-palette'

export interface SelectedCableVertexEditorProps {
  cable: Cable
  index: CableEndpointIndex
  /** The cable's own line colour (type colour, or red when over its limit). */
  color: string
  /** True when the cable is over, or possibly over, its length limit - it stays dashed while selected. */
  dashed: boolean
  strokeWidthPx: number
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  /** One call = one store write = one undo step. */
  onPointsChange: (id: string, points: CablePoint[]) => void
}

const HANDLE_RADIUS_SCREEN_PX = 5

/** Stops a click from reaching the Stage, whose "click on empty canvas" handler would deselect the cable. */
const stopClick = (e: KonvaEventObject<Event>) => {
  e.cancelBubble = true
}

/**
 * The selected cable, drawn here ONLY (the walls-Layer lines skip it): a
 * highlighted line plus one handle per intermediate vertex. Drag a handle to
 * move the vertex, double-click the line to insert one, double-click a
 * handle to remove it. The two ends belong to the device and the hub.
 *
 * Nothing is written to the store mid-drag: the line is redrawn from a
 * local preview and the drop is one undo step. Mounted last in the markers
 * Layer, so it is never part of the PNG export.
 */
export function SelectedCableVertexEditor({
  cable,
  index,
  color,
  dashed,
  strokeWidthPx,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onPointsChange,
}: SelectedCableVertexEditorProps) {
  const [preview, setPreview] = useState<CablePoint[] | null>(null)
  const path = resolveCablePathPx(preview ? { ...cable, points: preview } : cable, index)
  if (!path) return null

  const linePoints = path.flatMap((point) => [point.x, point.y])
  const clampHandle = (e: KonvaEventObject<DragEvent>): CablePoint => {
    const clamped = clampPointToImageBounds({ x: e.target.x(), y: e.target.y() }, imageWidthPx, imageHeightPx)
    e.target.position(clamped)
    return clamped
  }

  return (
    <>
      <Line
        points={linePoints}
        stroke={WALL_SELECTED_COLOR}
        strokeWidth={strokeWidthPx + 4 / viewportScale}
        opacity={0.45}
        lineJoin="round"
        lineCap="round"
        listening={false}
      />
      <Line
        points={linePoints}
        stroke={color}
        strokeWidth={strokeWidthPx}
        dash={dashed ? [5 * strokeWidthPx, 4 * strokeWidthPx] : undefined}
        lineJoin="round"
        lineCap="round"
        hitStrokeWidth={Math.max(strokeWidthPx, 12 / viewportScale)}
        onClick={stopClick}
        onTap={stopClick}
        onDblClick={(e) => {
          e.cancelBubble = true
          const pointer = e.target.getStage()?.getRelativePointerPosition()
          // At the cap nothing would change: skip the store write (it would still record an undo step).
          if (!pointer || cable.points.length >= MAX_CABLE_POINTS) return
          const at = clampPointToImageBounds(pointer, imageWidthPx, imageHeightPx)
          onPointsChange(cable.id, insertCablePointOnNearestSegment(path, at))
        }}
      />
      {cable.points.map((point, i) => (
        <Circle
          // Keyed by position too: after a drop the vertex has new coordinates, so a fresh handle replaces the dragged one.
          key={`${i}:${point.x},${point.y}`}
          x={point.x}
          y={point.y}
          radius={HANDLE_RADIUS_SCREEN_PX / viewportScale}
          fill="#ffffff"
          stroke={WALL_SELECTED_COLOR}
          strokeWidth={1.5 / viewportScale}
          hitStrokeWidth={8 / viewportScale}
          draggable
          onClick={stopClick}
          onTap={stopClick}
          onDblClick={(e) => {
            e.cancelBubble = true
            onPointsChange(cable.id, removeCablePoint(cable.points, i))
          }}
          onDragMove={(e) => setPreview(moveCablePoint(cable.points, i, clampHandle(e)))}
          onDragEnd={(e) => {
            const to = clampHandle(e)
            setPreview(null)
            // A drag that ends where it started is a no-op: the store ignores an unchanged patch only by reference.
            if (to.x !== point.x || to.y !== point.y) onPointsChange(cable.id, moveCablePoint(cable.points, i, to))
          }}
        />
      ))}
    </>
  )
}
