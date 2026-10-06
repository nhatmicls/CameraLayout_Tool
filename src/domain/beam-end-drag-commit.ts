import { clampPointToImageBounds, type Point } from './clamp'
import { MIN_BEAM_LENGTH_PX } from './sensor-types'

export interface BeamEndDragCommitInput {
  end: 'tx' | 'rx'
  /** Raw (unclamped) Konva node position at drag end. */
  draggedPos: Point
  /** The beam's pre-drag transmitter/receiver positions. */
  sensor: { x: number; y: number; x2: number; y2: number }
  imageWidthPx: number
  imageHeightPx: number
}

export interface BeamEndDragCommitResult {
  /** Where to snap the dragged Konva node (and the line endpoint) to, whether the drag commits or is refused. */
  nodePos: Point
  /** Null when the drag is refused (would leave the beam shorter than `MIN_BEAM_LENGTH_PX`) - the caller must not commit a patch, only snap the node back to `nodePos`. */
  commitPatch: { x: number; y: number } | { x2: number; y2: number } | null
}

/**
 * Resolves a beam transmitter/receiver end-drag: the dragged point clamped
 * to the image bounds (instead of leaving an out-of-bounds node visually
 * hanging off the plan), refused (snapped back to the end's own pre-drag
 * position) when the clamped point would leave the beam shorter than
 * `MIN_BEAM_LENGTH_PX` against the other, un-dragged end.
 */
export function resolveBeamEndDragCommit(input: BeamEndDragCommitInput): BeamEndDragCommitResult {
  const { end, draggedPos, sensor, imageWidthPx, imageHeightPx } = input
  const clamped = clampPointToImageBounds(draggedPos, imageWidthPx, imageHeightPx)
  const otherEnd = end === 'tx' ? { x: sensor.x2, y: sensor.y2 } : { x: sensor.x, y: sensor.y }

  if (Math.hypot(clamped.x - otherEnd.x, clamped.y - otherEnd.y) < MIN_BEAM_LENGTH_PX) {
    const preDragPos = end === 'tx' ? { x: sensor.x, y: sensor.y } : { x: sensor.x2, y: sensor.y2 }
    return { nodePos: preDragPos, commitPatch: null }
  }

  const commitPatch = end === 'tx' ? { x: clamped.x, y: clamped.y } : { x2: clamped.x, y2: clamped.y }
  return { nodePos: clamped, commitPatch }
}
