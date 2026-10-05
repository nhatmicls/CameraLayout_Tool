import { memo, useMemo, useState } from 'react'
import { Layer, Line } from 'react-konva'
import type { Wall } from '../domain/project-types'
import { moveWallNode, type WallNode } from '../domain/wall-node-editing'
import { WALL_GLASS_COLOR, WALL_OPAQUE_COLOR, WALL_SELECTED_COLOR } from './brand-and-dori-color-palette'
import { WallNodeDragHandles } from './wall-node-drag-handles'

export interface WallSegmentsLayerProps {
  walls: Wall[]
  /** Image px: wall lines are plan content, so they scale with zoom and look the same in the PNG export. */
  strokeWidthPx: number
  /** False in wall / calibrate mode and in the export: the whole layer stops listening. */
  selectable: boolean
  selectedWallId: string | null
  /** Only for the screen-constant click target. */
  viewportScale: number
  onSelectWall: (id: string) => void
  /** For clamping a dragged node to the plan. */
  imageWidthPx: number
  imageHeightPx: number
  /** A node (a point where walls end) was dragged and dropped. */
  onMoveWallNode: (from: WallNode, to: WallNode) => void
}

/** Screen px either side of a wall line that still counts as clicking it. */
const WALL_HIT_WIDTH_SCREEN_PX = 12

/**
 * Every wall as one line: opaque solid dark, glass dashed light blue, the
 * selected one blue. Memoised on its props, and `walls` keeps its array
 * identity across camera edits, so moving a camera never re-renders a wall.
 *
 * When selectable, every wall node also gets a drag handle. While a node is
 * being dragged the lines are drawn from a local preview (no store write);
 * the cones re-clip once, on drop.
 */
export const WallSegmentsLayer = memo(function WallSegmentsLayer({
  walls,
  strokeWidthPx,
  selectable,
  selectedWallId,
  viewportScale,
  onSelectWall,
  imageWidthPx,
  imageHeightPx,
  onMoveWallNode,
}: WallSegmentsLayerProps) {
  const [nodeDrag, setNodeDrag] = useState<{ from: WallNode; to: WallNode } | null>(null)
  const shownWalls = useMemo(
    () => (nodeDrag ? (moveWallNode(walls, nodeDrag.from, nodeDrag.to) ?? walls) : walls),
    [walls, nodeDrag],
  )

  return (
    <Layer listening={selectable}>
      {shownWalls.map((wall) => {
        const selected = wall.id === selectedWallId
        const baseColor = wall.kind === 'glass' ? WALL_GLASS_COLOR : WALL_OPAQUE_COLOR
        return (
          <Line
            key={wall.id}
            points={[wall.x1, wall.y1, wall.x2, wall.y2]}
            stroke={selected ? WALL_SELECTED_COLOR : baseColor}
            strokeWidth={strokeWidthPx}
            dash={wall.kind === 'glass' ? [4 * strokeWidthPx, 3 * strokeWidthPx] : undefined}
            lineCap="round"
            hitStrokeWidth={Math.max(strokeWidthPx, WALL_HIT_WIDTH_SCREEN_PX / viewportScale)}
            perfectDrawEnabled={false}
            onClick={(e) => {
              e.cancelBubble = true
              onSelectWall(wall.id)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onSelectWall(wall.id)
            }}
          />
        )
      })}
      {selectable && (
        <WallNodeDragHandles
          walls={walls}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onNodeDragPreview={setNodeDrag}
          onNodeDrop={onMoveWallNode}
        />
      )}
    </Layer>
  )
})
