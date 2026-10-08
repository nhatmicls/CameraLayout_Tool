import { useEffect, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Line } from 'react-konva'
import { buildCableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import {
  advanceHubTrunkDrawingChain,
  removeLastHubTrunkDrawingPoint,
  type HubTrunkDrawingChain,
} from '../../domain/cable/hub-trunk-drawing-chain'
import { findNearestCableSnapTarget } from '../../domain/cable/cable-snap-target-lookup'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { getActiveFloor, selectHubs, selectImage } from '../../state/project-store-floor-selectors'
import { WALL_SELECTED_COLOR, computeIconRadiusPx } from '../shared/brand-and-dori-color-palette'
import { isTypingTarget } from '../shared/is-typing-target'
import { resolveCableSnapTolerancePx, TRUNK_LINE_COLOR } from './cable-type-color-palette'

interface HubTrunkDrawingOverlayProps {
  stageRef: RefObject<Konva.Stage | null>
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
}

type Cursor = { x: number; y: number; hubId: string | null }

/**
 * Editor-only group for the "Draw route to hub" tool (`ToolMode 'trunk'`),
 * mounted in the stage's one editor-overlay Layer. Unlike the cable tool,
 * the start point is already known when the mode is entered (the hub
 * selected when the hub panel's button was clicked, read once here) - so
 * there is no "waiting for a start click" state. Further clicks add route
 * vertices; a click that snaps to another hub on this floor commits via
 * `setHubTrunk` and returns to select mode. Backspace removes the last
 * vertex; Esc cancels and returns to select (the owner hub stays selected
 * either way, so the hub panel's buttons are still right there).
 *
 * The markers Layer does not listen in this mode, so every click reaches
 * the Stage; snapping is geometric and restricted to hubs
 * (`findNearestCableSnapTarget(..., accept: 'hub')`) - a device marker is
 * never a target, same as a click on empty plan: both just add a vertex.
 */
export function HubTrunkDrawingOverlay({ stageRef, viewportScale, imageWidthPx, imageHeightPx }: HubTrunkDrawingOverlayProps) {
  const active = useEditorUiStore((s) => s.toolMode === 'trunk')
  // Subscribed (not `getState()`) so the preview re-renders if the start/target hub's position
  // changes while this effect's handlers are live - NOT from a drag (markers don't listen while a
  // drawing tool is active, so neither hub can actually be dragged mid-draw), but from undo/redo
  // or any other store write that moves one of them.
  const hubs = useProjectStore(selectHubs)

  const [chain, setChain] = useState<HubTrunkDrawingChain | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const chainRef = useRef<HubTrunkDrawingChain | null>(null)
  const viewportScaleRef = useRef(viewportScale)
  useEffect(() => {
    viewportScaleRef.current = viewportScale
  }, [viewportScale])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !active) return

    const startHubId = useEditorUiStore.getState().selectedHubId
    if (!startHubId) {
      // Should not happen (the hub panel button that enters this mode only shows while a
      // linked riser/drop is selected) - defensive fallback instead of drawing from nothing.
      useEditorUiStore.getState().setToolMode('select')
      return
    }

    const iconRadiusPx = computeIconRadiusPx(Math.max(imageWidthPx, imageHeightPx))
    const moveChain = (next: HubTrunkDrawingChain | null) => {
      chainRef.current = next
      setChain(next)
    }
    moveChain({ startHubId, points: [] })

    const resolvePointer = (): Cursor | null => {
      const raw = stage.getRelativePointerPosition()
      if (!raw) return null
      const { x, y } = clampPointToImageBounds(raw, imageWidthPx, imageHeightPx)
      const { cameras, sensors, hubs } = getActiveFloor(useProjectStore.getState())
      const snapTarget = findNearestCableSnapTarget(
        x,
        y,
        buildCableEndpointIndex(cameras, sensors, hubs),
        resolveCableSnapTolerancePx(viewportScaleRef.current, iconRadiusPx),
        'hub',
      )
      return { x, y, hubId: snapTarget?.kind === 'hub' ? snapTarget.hubId : null }
    }

    // A hub deleted, or the image replaced, while mid-draw: the chain's start may be gone - cancel.
    const unsubscribeFromProject = useProjectStore.subscribe((state, previous) => {
      if (selectHubs(state) !== selectHubs(previous) || selectImage(state) !== selectImage(previous)) {
        useEditorUiStore.getState().setToolMode('select')
      }
    })

    const handleClick = (e: KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return
      const point = resolvePointer()
      if (!point || !chainRef.current) return
      const step = advanceHubTrunkDrawingChain(chainRef.current, point)
      if (step.kind === 'continue') {
        moveChain(step.chain)
      } else if (step.kind === 'commit') {
        const { activeFloorId, setHubTrunk } = useProjectStore.getState()
        const applied = setHubTrunk({ floorId: activeFloorId, hubId: startHubId }, { hubId: step.hubId, points: step.points })
        if (!applied) {
          // The hub's own link changed (or it was removed) while mid-draw - should not happen
          // through normal use, but the draw is lost either way, so say so rather than silently
          // discarding it.
          useEditorUiStore.getState().pushNotification('error', 'Could not draw the route - this point is no longer linked.')
        }
        useEditorUiStore.getState().setToolMode('select')
      }
      setCursor(resolvePointer())
    }

    const handleMouseMove = () => setCursor(resolvePointer())

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'Escape') {
        useEditorUiStore.getState().setToolMode('select')
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        if (chainRef.current) moveChain(removeLastHubTrunkDrawingPoint(chainRef.current))
      }
    }

    stage.on('click.trunkdraw', handleClick)
    stage.on('mousemove.trunkdraw', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      stage.off('click.trunkdraw')
      stage.off('mousemove.trunkdraw')
      window.removeEventListener('keydown', handleKeyDown)
      unsubscribeFromProject()
      moveChain(null)
      setCursor(null)
    }
  }, [stageRef, active, imageWidthPx, imageHeightPx])

  if (!active || !chain) return null

  const startHub = hubs.find((hub) => hub.id === chain.startHubId)
  if (!startHub) return null

  const end = cursor?.hubId ? hubs.find((hub) => hub.id === cursor.hubId) : cursor
  const previewPoints = [{ x: startHub.x, y: startHub.y }, ...chain.points, ...(end ? [{ x: end.x, y: end.y }] : [])].flatMap((point) => [
    point.x,
    point.y,
  ])

  return (
    <Group listening={false}>
      {previewPoints.length >= 4 && (
        <Line points={previewPoints} stroke={TRUNK_LINE_COLOR} strokeWidth={2 / viewportScale} dash={[8 / viewportScale, 6 / viewportScale]} lineJoin="round" />
      )}
      {chain.points.map((point, i) => (
        <Circle key={i} x={point.x} y={point.y} radius={3 / viewportScale} fill={TRUNK_LINE_COLOR} />
      ))}
      <Circle x={startHub.x} y={startHub.y} radius={4 / viewportScale} fill={WALL_SELECTED_COLOR} />
      {cursor?.hubId && end && (
        <Circle x={end.x} y={end.y} radius={9 / viewportScale} stroke={WALL_SELECTED_COLOR} strokeWidth={2 / viewportScale} />
      )}
    </Group>
  )
}
