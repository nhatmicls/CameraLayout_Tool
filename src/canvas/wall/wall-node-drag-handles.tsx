import { useMemo } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle } from 'react-konva'
import type { Wall } from '../../domain/project-file/project-types'
import { findNearestWallEndpointWithinTolerance } from '../../domain/wall/wall-endpoint-snap-lookup'
import { listWallNodes, type WallNode } from '../../domain/wall/wall-node-editing'
import { WALL_SELECTED_COLOR, WALL_SNAP_TOLERANCE_SCREEN_PX } from '../shared/brand-and-dori-color-palette'

export interface WallNodeDragHandlesProps {
  walls: Wall[]
  /** Handles are screen-constant; the snap tolerance is too. */
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  /** Fired on every drag step with where the node would land (clamped + snapped); null when the drag ends. */
  onNodeDragPreview: (move: { from: WallNode; to: WallNode } | null) => void
  /** Fired once on drop. */
  onNodeDrop: (from: WallNode, to: WallNode) => void
}

const HANDLE_RADIUS_SCREEN_PX = 5

/**
 * One draggable dot per wall node (a point where walls end). Dragging a
 * node moves every wall end on it, so joined corners stay joined. While
 * dragging, the node is clamped to the image and snaps onto any OTHER node
 * within the drawing tool's tolerance; dropping it there joins the two.
 *
 * Nothing is written to the store mid-drag: the parent layer redraws the
 * walls from the preview, and the single drop is one undo step.
 */
export function WallNodeDragHandles({
  walls,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onNodeDragPreview,
  onNodeDrop,
}: WallNodeDragHandlesProps) {
  const nodes = useMemo(() => listWallNodes(walls), [walls])

  /** Where the dragged handle should sit: inside the image, pulled onto another node when close. */
  const resolveTarget = (from: WallNode, handle: Konva.Node): WallNode => {
    const x = Math.min(imageWidthPx, Math.max(0, handle.x()))
    const y = Math.min(imageHeightPx, Math.max(0, handle.y()))
    // The other nodes as zero-length segments, so the drawing tool's endpoint lookup can be reused as is.
    const others = nodes
      .filter((node) => node.x !== from.x || node.y !== from.y)
      .map((node) => ({ x1: node.x, y1: node.y, x2: node.x, y2: node.y }))
    return findNearestWallEndpointWithinTolerance(x, y, others, WALL_SNAP_TOLERANCE_SCREEN_PX / viewportScale) ?? { x, y }
  }

  return (
    <>
      {nodes.map((node) => (
        <Circle
          // Keyed by position: after a drop the node has new coordinates, so a fresh handle replaces the dragged one.
          key={`${node.x},${node.y}`}
          x={node.x}
          y={node.y}
          radius={HANDLE_RADIUS_SCREEN_PX / viewportScale}
          fill="#ffffff"
          stroke={WALL_SELECTED_COLOR}
          strokeWidth={1.5 / viewportScale}
          hitStrokeWidth={8 / viewportScale}
          draggable
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container()
            if (container) container.style.cursor = 'move'
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container()
            if (container) container.style.cursor = ''
          }}
          // A click on a handle is not a click on empty canvas (which would deselect).
          onClick={(e) => {
            e.cancelBubble = true
          }}
          onDragMove={(e: KonvaEventObject<DragEvent>) => {
            const to = resolveTarget(node, e.target)
            e.target.position(to)
            onNodeDragPreview({ from: node, to })
          }}
          onDragEnd={(e: KonvaEventObject<DragEvent>) => {
            const to = resolveTarget(node, e.target)
            // Back to the stored node: if the move is accepted this handle is replaced, if refused it is already home.
            e.target.position(node)
            onNodeDragPreview(null)
            onNodeDrop(node, to)
          }}
        />
      ))}
    </>
  )
}
