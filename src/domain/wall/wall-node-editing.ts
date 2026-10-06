import { MIN_WALL_LENGTH_PX, wallSegmentLengthPx, type WallSegment } from './wall-segment-geometry'

/**
 * Wall "nodes" are the points where walls end. Walls snapped together store
 * identical coordinates, so a node is identified by its exact (x, y): moving
 * it moves every wall end that sits on it, and a corner stays a corner.
 * Image px throughout.
 */

export interface WallNode {
  x: number
  y: number
}

/** Every distinct wall end, in first-seen order. */
export function listWallNodes(walls: readonly WallSegment[]): WallNode[] {
  const seen = new Set<string>()
  const nodes: WallNode[] = []
  const add = (x: number, y: number) => {
    const key = `${x},${y}`
    if (seen.has(key)) return
    seen.add(key)
    nodes.push({ x, y })
  }
  for (const wall of walls) {
    add(wall.x1, wall.y1)
    add(wall.x2, wall.y2)
  }
  return nodes
}

/**
 * Moves the node at exactly `from` to `to`. Returns the new wall list, in
 * which walls not touching the node keep their object identity, or `null`
 * when nothing would change (no wall ends on `from`, or `to` equals `from`)
 * or when the move would collapse a wall to less than `MIN_WALL_LENGTH_PX`
 * (dragging a node onto the other end of its own wall).
 */
export function moveWallNode<T extends WallSegment>(walls: readonly T[], from: WallNode, to: WallNode): T[] | null {
  if (from.x === to.x && from.y === to.y) return null

  let moved = false
  const next: T[] = []
  for (const wall of walls) {
    const startsOnNode = wall.x1 === from.x && wall.y1 === from.y
    const endsOnNode = wall.x2 === from.x && wall.y2 === from.y
    if (!startsOnNode && !endsOnNode) {
      next.push(wall)
      continue
    }
    const updated: T = {
      ...wall,
      ...(startsOnNode ? { x1: to.x, y1: to.y } : {}),
      ...(endsOnNode ? { x2: to.x, y2: to.y } : {}),
    }
    if (wallSegmentLengthPx(updated) < MIN_WALL_LENGTH_PX) return null
    next.push(updated)
    moved = true
  }
  return moved ? next : null
}
