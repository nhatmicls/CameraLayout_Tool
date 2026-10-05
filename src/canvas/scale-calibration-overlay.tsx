import { useEffect, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import { Circle, Group, Line, Text } from 'react-konva'
import { useProjectStore } from '../state/project-store'
import { useEditorUiStore } from '../state/editor-ui-store'
import type { RefLine } from '../domain/scale-calibration-calculator'

interface ScaleCalibrationOverlayProps {
  stageRef: RefObject<Konva.Stage | null>
  /** Current stage zoom - stroke widths/markers are divided by this so they read as a constant screen size at any zoom. */
  viewportScale: number
  /** True while the length dialog is open for a just-drawn line; suppresses starting a new one underneath it. */
  dialogOpen: boolean
  onLineDrawn: (line: RefLine) => void
}

/**
 * Konva group (mounted in the stage's one editor-overlay Layer) for the "set scale" tool: click point A, click point B (with a
 * live rubber-band preview between them), then hand the finished line to the
 * parent to open the length dialog. Also draws the persisted calibration
 * line (if any) so the user can see what is currently calibrated.
 * Listens on the Stage directly (imperative Konva `on`/`off`) rather than a
 * hit-testable shape, since Konva only fires pointer events on shapes - the
 * Stage itself is the one node that always receives clicks on empty canvas.
 */
export function ScaleCalibrationOverlay({ stageRef, viewportScale, dialogOpen, onLineDrawn }: ScaleCalibrationOverlayProps) {
  const scale = useProjectStore((s) => s.scale)
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const showCalibrationLine = useEditorUiStore((s) => s.showCalibrationLine)

  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null)
  const [cursorPoint, setCursorPoint] = useState<{ x: number; y: number } | null>(null)
  // Mirrors pendingPoint for the stage-event closures below without re-subscribing on every render.
  const pendingPointRef = useRef(pendingPoint)
  useEffect(() => {
    pendingPointRef.current = pendingPoint
  }, [pendingPoint])

  const active = toolMode === 'calibrate' && !dialogOpen

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !active) return

    const handleClick = () => {
      const point = stage.getRelativePointerPosition()
      if (!point) return

      const first = pendingPointRef.current
      if (!first) {
        setPendingPoint(point)
        return
      }
      onLineDrawn({ x1: first.x, y1: first.y, x2: point.x, y2: point.y })
      setPendingPoint(null)
      setCursorPoint(null)
    }

    const handleMouseMove = () => {
      if (!pendingPointRef.current) return
      setCursorPoint(stage.getRelativePointerPosition())
    }

    stage.on('click.calibration', handleClick)
    stage.on('mousemove.calibration', handleMouseMove)
    return () => {
      stage.off('click.calibration')
      stage.off('mousemove.calibration')
    }
  }, [stageRef, active, onLineDrawn])

  // Esc cancels the in-progress line (first point placed, no second click yet).
  useEffect(() => {
    if (!pendingPoint) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingPoint(null)
        setCursorPoint(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingPoint])

  const strokeWidth = 2 / viewportScale
  const markerRadius = 5 / viewportScale

  return (
    <Group>
      {showCalibrationLine && scale && (
        <>
          <Line
            points={[scale.refLine.x1, scale.refLine.y1, scale.refLine.x2, scale.refLine.y2]}
            stroke="#f59e0b"
            strokeWidth={strokeWidth}
          />
          <Circle x={scale.refLine.x1} y={scale.refLine.y1} radius={markerRadius} fill="#f59e0b" />
          <Circle x={scale.refLine.x2} y={scale.refLine.y2} radius={markerRadius} fill="#f59e0b" />
          <Text
            x={(scale.refLine.x1 + scale.refLine.x2) / 2}
            y={(scale.refLine.y1 + scale.refLine.y2) / 2 - 16 / viewportScale}
            text={`${scale.refLengthM} m`}
            fontSize={13 / viewportScale}
            fill="#92400e"
          />
        </>
      )}

      {pendingPoint && (
        <>
          <Circle x={pendingPoint.x} y={pendingPoint.y} radius={markerRadius} fill="#2563eb" />
          {cursorPoint && (
            <Line
              points={[pendingPoint.x, pendingPoint.y, cursorPoint.x, cursorPoint.y]}
              stroke="#2563eb"
              strokeWidth={strokeWidth}
              dash={[8 / viewportScale, 6 / viewportScale]}
            />
          )}
        </>
      )}
    </Group>
  )
}
