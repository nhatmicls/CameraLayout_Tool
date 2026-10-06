import { useCallback } from 'react'
import { countWallsProperlyCrossedBySegment } from '../../domain/wall/wall-crossing-detection'
import type { WallNode } from '../../domain/wall/wall-node-editing'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * Commits a dragged wall node to the store (one undo step) and, like the
 * drawing tool, warns - without refusing - when a wall it moved now
 * properly crosses another wall.
 */
export function useWallNodeMoveHandler(): (from: WallNode, to: WallNode) => void {
  return useCallback((from, to) => {
    const before = useProjectStore.getState().walls
    useProjectStore.getState().moveWallNode(from, to)
    const after = useProjectStore.getState().walls
    if (after === before) return // refused (would collapse a wall) or not moved

    const movedWalls = after.filter((wall, index) => wall !== before[index])
    const crosses = movedWalls.some(
      (wall) => countWallsProperlyCrossedBySegment(wall, after.filter((other) => other !== wall)) > 0,
    )
    if (crosses) {
      useEditorUiStore
        .getState()
        .pushNotification(
          'warning',
          'A moved wall now crosses another wall. Coverage is still calculated, but walls are expected to meet at endpoints.',
        )
    }
  }, [])
}
