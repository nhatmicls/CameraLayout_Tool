import { useEffect, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Line } from 'react-konva'
import {
  acceptedSnapKind,
  advanceCableDrawingChain,
  removeLastCableDrawingPoint,
  type CableDrawingChain,
} from '../../domain/cable/cable-drawing-chain'
import { buildCableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import { MAX_CABLES } from '../../domain/cable/cable-layout-types'
import { findNearestCableSnapTarget, type CableSnapTarget } from '../../domain/cable/cable-snap-target-lookup'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { WALL_SELECTED_COLOR, computeIconRadiusPx } from '../shared/brand-and-dori-color-palette'
import { cableTypeColor, resolveCableSnapTolerancePx } from './cable-type-color-palette'

interface CableDrawingOverlayProps {
  stageRef: RefObject<Konva.Stage | null>
  /** Current stage zoom - the snap tolerance and the overlay's markers are screen-constant. */
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
}

type Cursor = { x: number; y: number; snapTarget: CableSnapTarget | null }

const START_HINT = 'Start on a camera, a sensor or a hub.'

/**
 * Editor-only group for the "Draw cable" tool, mounted in the stage's one
 * editor-overlay Layer (never part of the PNG export). The first click must
 * land on a device or a hub; further clicks add route vertices; a click on
 * the opposite kind (hub after device, device after hub) commits ONE cable.
 * Backspace removes the last vertex; Esc cancels the cable, a second Esc
 * leaves the mode. The chain also resets when cameras, sensors, hubs or the
 * image change from outside this tool (undo / redo, a project opened), so a
 * cable can never start on something that is gone.
 *
 * The markers Layer does not listen in this mode, so every click reaches
 * the Stage; snapping is geometric (`findNearestCableSnapTarget`). Handlers
 * read the stores through `getState()` and refs, like the wall overlay, so
 * they are not re-subscribed on every edit or zoom change.
 */
export function CableDrawingOverlay({ stageRef, viewportScale, imageWidthPx, imageHeightPx }: CableDrawingOverlayProps) {
  const active = useEditorUiStore((s) => s.toolMode === 'cable')
  const cableDrawTypeId = useEditorUiStore((s) => s.cableDrawTypeId)
  const cableTypes = useProjectStore((s) => s.cableTypes)

  const [chain, setChain] = useState<CableDrawingChain | null>(null)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  // The chain as the stage closures see it; `chain` state is its render copy.
  const chainRef = useRef<CableDrawingChain | null>(null)
  const viewportScaleRef = useRef(viewportScale)
  useEffect(() => {
    viewportScaleRef.current = viewportScale
  }, [viewportScale])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !active) return

    const iconRadiusPx = computeIconRadiusPx(Math.max(imageWidthPx, imageHeightPx))
    let startHintShown = false // one hint per mode entry
    const moveChain = (next: CableDrawingChain | null) => {
      chainRef.current = next
      setChain(next)
    }
    const resolvePointer = (): Cursor | null => {
      const raw = stage.getRelativePointerPosition()
      if (!raw) return null
      const { x, y } = clampPointToImageBounds(raw, imageWidthPx, imageHeightPx)
      const { cameras, sensors, hubs } = useProjectStore.getState()
      const snapTarget = findNearestCableSnapTarget(
        x,
        y,
        buildCableEndpointIndex(cameras, sensors, hubs),
        resolveCableSnapTolerancePx(viewportScaleRef.current, iconRadiusPx),
        acceptedSnapKind(chainRef.current),
      )
      return { x, y, snapTarget }
    }

    const unsubscribeFromProject = useProjectStore.subscribe((state, previous) => {
      const endsChanged = state.cameras !== previous.cameras || state.sensors !== previous.sensors || state.hubs !== previous.hubs
      if (endsChanged || state.image !== previous.image) moveChain(null)
    })

    const handleClick = (e: KonvaEventObject<MouseEvent>) => {
      if (e.evt.button !== 0) return
      const point = resolvePointer()
      if (!point) return
      const step = advanceCableDrawingChain(chainRef.current, point)
      const { pushNotification, cableDrawTypeId: typeId } = useEditorUiStore.getState()
      if (step.kind === 'continue') {
        moveChain(step.chain)
      } else if (step.kind === 'commit') {
        const { cables, cableTypes: types, addCable } = useProjectStore.getState()
        const type = types.find((candidate) => candidate.id === typeId) ?? types[0]
        if (cables.length >= MAX_CABLES) pushNotification('error', `A project can hold at most ${MAX_CABLES} cables.`)
        else if (type) addCable({ id: crypto.randomUUID(), ...step.cable, typeId: type.id })
        moveChain(null)
      } else if (step.reason === 'start-needs-target' && !startHintShown) {
        startHintShown = true
        pushNotification('info', START_HINT)
      }
      setCursor(resolvePointer()) // the accepted snap kind may have flipped
    }

    const handleMouseMove = () => setCursor(resolvePointer())

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') {
        if (chainRef.current) moveChain(null)
        else useEditorUiStore.getState().setToolMode('select')
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        if (chainRef.current) moveChain(removeLastCableDrawingPoint(chainRef.current))
      }
    }

    stage.on('click.cabledraw', handleClick)
    stage.on('mousemove.cabledraw', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      stage.off('click.cabledraw')
      stage.off('mousemove.cabledraw')
      window.removeEventListener('keydown', handleKeyDown)
      unsubscribeFromProject()
      moveChain(null)
      setCursor(null)
    }
  }, [stageRef, active, imageWidthPx, imageHeightPx])

  if (!active) return null

  const typeIndex = Math.max(0, cableTypes.findIndex((type) => type.id === cableDrawTypeId))
  const color = cableTypeColor(typeIndex)
  const end = cursor ? (cursor.snapTarget ?? cursor) : null
  const previewPoints = chain ? [chain.start, ...chain.points, ...(end ? [end] : [])].flatMap((point) => [point.x, point.y]) : []

  return (
    <Group listening={false}>
      {previewPoints.length >= 4 && (
        <Line
          points={previewPoints}
          stroke={color}
          strokeWidth={2 / viewportScale}
          dash={[8 / viewportScale, 6 / viewportScale]}
          lineJoin="round"
        />
      )}
      {chain?.points.map((point, i) => (
        <Circle key={i} x={point.x} y={point.y} radius={3 / viewportScale} fill={color} />
      ))}
      {chain && <Circle x={chain.start.x} y={chain.start.y} radius={4 / viewportScale} fill={WALL_SELECTED_COLOR} />}
      {cursor?.snapTarget && (
        <Circle
          x={cursor.snapTarget.x}
          y={cursor.snapTarget.y}
          radius={9 / viewportScale}
          stroke={WALL_SELECTED_COLOR}
          strokeWidth={2 / viewportScale}
        />
      )}
    </Group>
  )
}
