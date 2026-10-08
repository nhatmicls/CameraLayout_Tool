import { useState } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Line } from 'react-konva'
import { MAX_CABLE_POINTS, type CablePoint } from '../../domain/cable/cable-layout-types'
import { insertCablePointOnNearestSegment, moveCablePoint, removeCablePoint } from '../../domain/cable/cable-polyline-editing'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { WALL_SELECTED_COLOR } from '../shared/brand-and-dori-color-palette'

export interface SelectedRouteVertexEditorProps {
  /** The owning cable's or hub's id - `onPointsChange`'s first argument, nothing else. */
  routeId: string
  /** Intermediate points only; the two ends come from `startPx`/`endPx`. */
  points: CablePoint[]
  /** Device or hub position (a cable's start), or a hub's own position (a trunk's start). */
  startPx: CablePoint
  /** Hub position (a cable's end, or a trunk's target hub). */
  endPx: CablePoint
  /** The route's own line colour (type colour for a cable, or red when over its limit; a neutral colour for a trunk). */
  color: string
  /** The route's own dash pattern (undefined = solid) - the caller decides: a cable is dashed only
   * over/possibly-over its limit, a trunk is ALWAYS dotted (same pattern as the unselected
   * `HubTrunkRouteLines`, per the PNG legend's "dotted = route to hub") - selection is conveyed by
   * the highlighted glow line underneath, not by switching to solid. */
  dash: number[] | undefined
  strokeWidthPx: number
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  /** One call = one store write = one undo step. */
  onPointsChange: (id: string, points: CablePoint[]) => void
}

const HANDLE_RADIUS_SCREEN_PX = 5

/** Stops a click from reaching the Stage, whose "click on empty canvas" handler would deselect the cable/hub. */
const stopClick = (e: KonvaEventObject<Event>) => {
  e.cancelBubble = true
}

/**
 * The ONE vertex editor for a point-editable route - a selected cable
 * (device -> hub) or a selected hub's own trunk (hub -> hub) - generalised
 * over plain start/end points so neither kind needs its own copy (DRY): a
 * highlighted line plus one handle per intermediate vertex. Drag a handle to
 * move the vertex, double-click the line to insert one, double-click a
 * handle to remove it. The two ends are never edited here - they derive from
 * the live device/hub positions the caller resolved into `startPx`/`endPx`.
 *
 * Nothing is written to the store mid-drag: the line is redrawn from a
 * local preview and the drop is one undo step. Mounted last in the markers
 * Layer, so it is never part of the PNG export.
 */
export function SelectedRouteVertexEditor({
  routeId,
  points,
  startPx,
  endPx,
  color,
  dash,
  strokeWidthPx,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onPointsChange,
}: SelectedRouteVertexEditorProps) {
  const [preview, setPreview] = useState<CablePoint[] | null>(null)
  const path = [startPx, ...(preview ?? points), endPx]

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
        dash={dash}
        lineJoin="round"
        lineCap="round"
        hitStrokeWidth={Math.max(strokeWidthPx, 12 / viewportScale)}
        onClick={stopClick}
        onTap={stopClick}
        onDblClick={(e) => {
          e.cancelBubble = true
          const pointer = e.target.getStage()?.getRelativePointerPosition()
          // At the cap nothing would change: skip the store write (it would still record an undo step).
          if (!pointer || points.length >= MAX_CABLE_POINTS) return
          const at = clampPointToImageBounds(pointer, imageWidthPx, imageHeightPx)
          onPointsChange(routeId, insertCablePointOnNearestSegment(path, at))
        }}
      />
      {points.map((point, i) => (
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
            onPointsChange(routeId, removeCablePoint(points, i))
          }}
          onDragMove={(e) => setPreview(moveCablePoint(points, i, clampHandle(e)))}
          onDragEnd={(e) => {
            const to = clampHandle(e)
            setPreview(null)
            // A drag that ends where it started is a no-op: the store ignores an unchanged patch only by reference.
            if (to.x !== point.x || to.y !== point.y) onPointsChange(routeId, moveCablePoint(points, i, to))
          }}
        />
      ))}
    </>
  )
}
