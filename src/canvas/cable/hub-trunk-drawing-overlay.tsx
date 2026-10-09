import { useEffect, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Line } from 'react-konva'
import { buildCableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import type { CableEndRef } from '../../domain/cable/cable-layout-types'
import {
  advanceHubTrunkDrawingChain,
  removeLastHubTrunkDrawingPoint,
  type HubTrunkDrawingChain,
} from '../../domain/cable/hub-trunk-drawing-chain'
import { findNearestCableSnapTarget } from '../../domain/cable/cable-snap-target-lookup'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
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

/** `snap` = where the click would land (a hub, or - shaft leg only - a device); null = a free vertex. */
type Cursor = { x: number; y: number; hubId: string | null; device?: CableEndRef; snap: { x: number; y: number } | null }

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
 * never a target, same as a click on empty plan: both just add a vertex. A
 * SHAFT marker is excluded from the snap set entirely (decision D1, phase 6
 * review: a trunk may never target a shaft - cables enter shafts, routes
 * leave them), so clicking near one also just adds a vertex, same as a
 * device; `setHubTrunk` refuses it too, defensively, if this ever changes.
 *
 * SHAFT LEG: when the shaft panel set `shaftLegDrawCable` before entering
 * the mode, the same tool draws that ONE cable's own route beyond its shaft
 * instead - from the selected shaft opening to a hub (not a shaft opening)
 * or ANY device on this floor except the cable's own start - committed via
 * `setCableShaftLeg`.
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

    // Read once at mode entry, like the start hub: which cable's leg this draw is for, if any.
    const legCable = useEditorUiStore.getState().shaftLegDrawCable
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
      const state = useProjectStore.getState()
      const { cameras, sensors, hubs, fireAlarmDevices } = getActiveFloor(state)
      // D1: a shaft marker can never be a route TARGET - excluded from the snap set entirely, so a
      // click near one adds a vertex instead of "finishing" onto it.
      const targetableHubs = hubs.filter((candidateHub) => candidateHub.kind !== 'shaft')
      // A leg drawn on the cable's own floor may not end on the cable's own start device.
      const legOwnStart =
        legCable && legCable.floorId === state.activeFloorId
          ? state.floors.find((floor) => floor.id === legCable.floorId)?.cables.find((cable) => cable.id === legCable.cableId)?.device
          : undefined
      const snapTarget = findNearestCableSnapTarget(
        x,
        y,
        buildCableEndpointIndex(cameras, sensors, targetableHubs, undefined, { devices: fireAlarmDevices, modelById: fireAlarmModelSpecById }),
        resolveCableSnapTolerancePx(viewportScaleRef.current, iconRadiusPx),
        legCable ? 'any' : 'hub',
        legOwnStart,
      )
      return {
        x,
        y,
        hubId: snapTarget?.kind === 'hub' ? snapTarget.hubId : null,
        device: snapTarget?.kind === 'device' ? snapTarget.ref : undefined,
        snap: snapTarget ? { x: snapTarget.x, y: snapTarget.y } : null,
      }
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
      } else if (step.kind === 'commit' || step.kind === 'commit-device') {
        const { activeFloorId, setHubTrunk, setCableShaftLeg } = useProjectStore.getState()
        const end = step.kind === 'commit' ? { hubId: step.hubId } : { endDevice: step.device }
        const applied = legCable
          ? setCableShaftLeg(legCable.floorId, legCable.cableId, { floorId: activeFloorId, points: step.points, ...end })
          : step.kind === 'commit' && setHubTrunk({ floorId: activeFloorId, hubId: startHubId }, { hubId: step.hubId, points: step.points })
        if (!applied) {
          // The point, the cable or the target changed (or was removed) while mid-draw - should
          // not happen through normal use, but the draw is lost either way, so say so rather than
          // silently discarding it.
          useEditorUiStore.getState().pushNotification('error', 'Could not draw the route - this point or target is no longer valid.')
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

  const end = cursor ? (cursor.snap ?? cursor) : null
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
      {cursor?.snap && end && (
        <Circle x={end.x} y={end.y} radius={9 / viewportScale} stroke={WALL_SELECTED_COLOR} strokeWidth={2 / viewportScale} />
      )}
    </Group>
  )
}
