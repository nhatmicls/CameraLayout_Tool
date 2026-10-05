import { useEffect, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Line } from 'react-konva'
import { MAX_WALLS } from '../domain/project-file-schema'
import { countWallsProperlyCrossedBySegment } from '../domain/wall-crossing-detection'
import { MIN_WALL_LENGTH_PX, isSameWallSegment } from '../domain/wall-segment-geometry'
import { useEditorUiStore } from '../state/editor-ui-store'
import { useProjectStore } from '../state/project-store'
import {
  WALL_GLASS_COLOR,
  WALL_OPAQUE_COLOR,
  WALL_SELECTED_COLOR,
  WALL_SNAP_TOLERANCE_SCREEN_PX,
} from './brand-and-dori-color-palette'
import { resolveWallDrawingPoint, type WallDrawingPoint } from './wall-drawing-point-resolver'

interface WallDrawingOverlayProps {
  stageRef: RefObject<Konva.Stage | null>
  /** Current stage zoom - the snap tolerance and the overlay's markers are screen-constant. */
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
}

type Point = { x: number; y: number }

/**
 * Editor-only group for the "draw walls" tool, mounted in the stage's one
 * editor-overlay Layer (never part of the PNG export). Click places a point; each further click commits one wall
 * segment from the previous point and continues the chain. The chain ends
 * on a click on its last point (so a double-click ends it), on closing the
 * loop onto its start, or on Esc; Esc with no chain leaves wall mode. It
 * also ends when the walls or the image change from outside this tool
 * (undo / redo, a project or image opened), so the next click can never
 * continue from a point whose wall is gone or that belongs to another plan.
 *
 * Panning stays a plain left-drag: Konva cancels the click once a drag
 * passes its drag distance, so a pan never places a point, and the chain is
 * held in image px, which a pan does not change.
 *
 * Listens on the Stage (namespaced `on`/`off`), like the calibration
 * overlay. Handlers read walls / kind / zoom through `getState()` and refs,
 * so they are not re-subscribed on every wall or zoom change.
 */
export function WallDrawingOverlay({ stageRef, viewportScale, imageWidthPx, imageHeightPx }: WallDrawingOverlayProps) {
  const active = useEditorUiStore((s) => s.toolMode === 'wall')
  const wallDrawKind = useEditorUiStore((s) => s.wallDrawKind)

  const [anchor, setAnchor] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<WallDrawingPoint | null>(null)
  // The chain as the stage closures see it; `anchor` state is its render copy.
  const anchorRef = useRef<Point | null>(null)
  const chainStartRef = useRef<Point | null>(null)
  const viewportScaleRef = useRef(viewportScale)
  useEffect(() => {
    viewportScaleRef.current = viewportScale
  }, [viewportScale])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !active) return

    const moveAnchor = (point: Point | null) => {
      anchorRef.current = point
      setAnchor(point)
    }
    const endChain = () => {
      chainStartRef.current = null
      moveAnchor(null)
    }
    const resolvePointer = (): WallDrawingPoint | null => {
      const raw = stage.getRelativePointerPosition()
      if (!raw) return null
      return resolveWallDrawingPoint(raw, {
        imageWidthPx,
        imageHeightPx,
        walls: useProjectStore.getState().walls,
        anchor: anchorRef.current,
        snapTolerancePx: WALL_SNAP_TOLERANCE_SCREEN_PX / viewportScaleRef.current,
      })
    }

    // True only while this tool's own addWall runs, so the subscription below ignores it.
    let isOwnWallWrite = false
    const unsubscribeFromProject = useProjectStore.subscribe((state, previous) => {
      if (isOwnWallWrite) return
      if (state.walls !== previous.walls || state.image !== previous.image) endChain()
    })

    const handleClick = (e: KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return
      const point = resolvePointer()
      if (!point) return
      const from = anchorRef.current
      if (!from) {
        chainStartRef.current = { x: point.x, y: point.y }
        moveAnchor({ x: point.x, y: point.y })
        return
      }
      // A click on the last point (also the second half of a double-click) ends the chain.
      if (Math.hypot(point.x - from.x, point.y - from.y) < MIN_WALL_LENGTH_PX) {
        endChain()
        return
      }

      const { walls, addWall } = useProjectStore.getState()
      const { wallDrawKind: kind, pushNotification } = useEditorUiStore.getState()
      if (walls.length >= MAX_WALLS) {
        pushNotification('error', `A project can hold at most ${MAX_WALLS} walls.`)
        endChain()
        return
      }
      const segment = { x1: from.x, y1: from.y, x2: point.x, y2: point.y }
      // Clicking back along a wall just drawn (A -> B -> A) would stack a second wall on the first.
      if (walls.some((wall) => isSameWallSegment(wall, segment))) {
        endChain()
        return
      }
      const crossedCount = countWallsProperlyCrossedBySegment(segment, walls) // before addWall: must not count itself
      isOwnWallWrite = true
      addWall({ id: crypto.randomUUID(), kind, ...segment })
      isOwnWallWrite = false
      if (crossedCount > 0) {
        pushNotification(
          'warning',
          `This wall crosses ${crossedCount} existing wall(s). Coverage is still calculated, but walls are expected to meet at endpoints.`,
        )
      }

      const start = chainStartRef.current
      if (start && point.x === start.x && point.y === start.y) endChain() // loop closed
      else moveAnchor({ x: point.x, y: point.y })
    }

    // Tracked even before the first click, so the snap ring shows where a new chain would start.
    const handleMouseMove = () => setCursor(resolvePointer())

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const target = e.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (anchorRef.current) endChain()
      else useEditorUiStore.getState().setToolMode('select')
    }

    stage.on('click.walldraw', handleClick)
    stage.on('mousemove.walldraw', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      stage.off('click.walldraw')
      stage.off('mousemove.walldraw')
      window.removeEventListener('keydown', handleKeyDown)
      unsubscribeFromProject()
      endChain()
      setCursor(null)
    }
  }, [stageRef, active, imageWidthPx, imageHeightPx])

  if (!active) return null

  const color = wallDrawKind === 'glass' ? WALL_GLASS_COLOR : WALL_OPAQUE_COLOR
  return (
    <Group listening={false}>
      {anchor && cursor && (
        <Line
          points={[anchor.x, anchor.y, cursor.x, cursor.y]}
          stroke={color}
          strokeWidth={2 / viewportScale}
          dash={[8 / viewportScale, 6 / viewportScale]}
        />
      )}
      {anchor && <Circle x={anchor.x} y={anchor.y} radius={4 / viewportScale} fill={WALL_SELECTED_COLOR} />}
      {cursor?.snapped && (
        <Circle
          x={cursor.x}
          y={cursor.y}
          radius={7 / viewportScale}
          stroke={WALL_SELECTED_COLOR}
          strokeWidth={2 / viewportScale}
        />
      )}
    </Group>
  )
}
