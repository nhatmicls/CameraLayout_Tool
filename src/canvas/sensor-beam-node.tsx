import { memo, useMemo, useRef } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Line } from 'react-konva'
import { resolveBeamEndDragCommit } from '../domain/beam-end-drag-commit'
import { checkBeamLine } from '../domain/beam-sensor-line-check'
import { metersToPlanPx } from '../domain/scale-calibration-calculator'
import { resolveBeamMaxDistanceM } from '../domain/sensor-coverage-resolver'
import type { BeamModelSpec, PlacedBeamSensor, PlacedSensorPatch } from '../domain/sensor-types'
import type { WallSegment } from '../domain/wall-segment-geometry'
import { SensorBeamBlockedOverlay } from './sensor-beam-blocked-overlay'
import { SensorBeamEndMarker } from './sensor-beam-end-marker'
import { BEAM_BLOCKED_COLOR, BEAM_OVER_DISTANCE_COLOR, SENSOR_KIND_COLORS } from './sensor-kind-color-palette'

interface SensorBeamNodeProps {
  sensor: PlacedBeamSensor
  spec: BeamModelSpec
  /** "S{n}" shown at the transmitter; the receiver always shows the literal "RX". */
  label: string
  iconRadiusPx: number
  selected: boolean
  /** False in export mode: no dragging, no selection ring (see `plan-scene-layers.tsx`). */
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  planPxPerMeter: number
  opaqueWalls: readonly WallSegment[]
  glassWalls: readonly WallSegment[]
  wallClearancePx: number
  onSelect: (id: string) => void
  /** One commit callback for either end - `{ x, y }` for the transmitter, `{ x2, y2 }` for the receiver. */
  onCommit: (id: string, patch: PlacedSensorPatch) => void
}

/** Screen-constant extra click/drag target around the thin beam line, CSS px before dividing by viewport scale. */
const BEAM_HIT_STROKE_SCREEN_PX = 14
/** Dash pattern (image px) for the over-distance / blocked tail. */
const BEAM_DASH_PX: [number, number] = [8, 6]

/**
 * One active IR beam: the transmitter-to-receiver line plus both end
 * markers (`sensor-beam-end-marker.tsx`). Unlike a sector/circle sensor, a
 * beam does not use the shared live-handle registry - this Group is
 * self-contained: dragging an end moves the Konva `Line`'s points directly
 * through a ref (no store write, no React render), and the three-state line
 * colour (clear / over-distance / blocked) is computed from the last
 * *committed* position only, recomputed on drop (beam state is deliberately
 * stale mid-drag - accepted for perf). Blocked wins over over-distance:
 * solid to the crossing point, dashed
 * `BEAM_BLOCKED_COLOR` beyond it, with a small cross at the crossing - drawn
 * as a second, non-listening line painted on top of the (fully dashed) base
 * line so the pre-crossing stretch reads solid.
 */
export const SensorBeamNode = memo(function SensorBeamNode({
  sensor,
  spec,
  label,
  iconRadiusPx,
  selected,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  planPxPerMeter,
  opaqueWalls,
  glassWalls,
  wallClearancePx,
  onSelect,
  onCommit,
}: SensorBeamNodeProps) {
  const lineRef = useRef<Konva.Line>(null)
  const txRef = useRef<Konva.Group>(null)
  const rxRef = useRef<Konva.Group>(null)

  const maxDistancePx = useMemo(
    () => metersToPlanPx(resolveBeamMaxDistanceM(spec, sensor.environment).limitM, planPxPerMeter),
    [spec, sensor.environment, planPxPerMeter],
  )
  const check = useMemo(
    () =>
      checkBeamLine({
        x1: sensor.x,
        y1: sensor.y,
        x2: sensor.x2,
        y2: sensor.y2,
        opaqueWalls,
        glassWalls,
        clearancePx: wallClearancePx,
        maxDistancePx,
      }),
    [sensor.x, sensor.y, sensor.x2, sensor.y2, opaqueWalls, glassWalls, wallClearancePx, maxDistancePx],
  )

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true
    onSelect(sensor.id)
  }

  // Mid-drag follow: move the shared line's endpoint; the other end's group stays put until its own drag.
  const moveLineEnd = (end: 'tx' | 'rx', x: number, y: number) => {
    const line = lineRef.current
    if (!line) return
    const points = line.points()
    if (end === 'tx') {
      points[0] = x
      points[1] = y
    } else {
      points[2] = x
      points[3] = y
    }
    line.points(points)
  }

  const handleEndDragMove = (end: 'tx' | 'rx') => (e: KonvaEventObject<DragEvent>) => {
    if (e.target !== e.currentTarget) return
    moveLineEnd(end, e.target.x(), e.target.y())
  }

  // Clamps the dragged end to the image and refuses a commit that would leave the beam
  // shorter than `MIN_BEAM_LENGTH_PX`, snapping the node + line back to where this end started
  // instead. The decision itself is pure (`resolveBeamEndDragCommit`) - this handler only
  // applies the Konva/store side effects.
  const handleEndDragEnd = (end: 'tx' | 'rx') => (e: KonvaEventObject<DragEvent>) => {
    if (e.target !== e.currentTarget) return
    const { nodePos, commitPatch } = resolveBeamEndDragCommit({
      end,
      draggedPos: { x: e.target.x(), y: e.target.y() },
      sensor,
      imageWidthPx,
      imageHeightPx,
    })
    e.target.position(nodePos)
    moveLineEnd(end, nodePos.x, nodePos.y)
    if (commitPatch) onCommit(sensor.id, commitPatch)
  }

  const baseColor = check.blockedAt ? BEAM_BLOCKED_COLOR : check.overMaxDistance ? BEAM_OVER_DISTANCE_COLOR : SENSOR_KIND_COLORS.beam
  const baseDashed = check.blockedAt !== null || check.overMaxDistance
  const strokeWidth = selected ? 2.5 : 1.5
  const hitStrokeWidth = BEAM_HIT_STROKE_SCREEN_PX / viewportScale

  return (
    <Group>
      {/* Base line: always spans the full TX->RX length, ref-driven so a drag follows live. Clickable - selects the beam. */}
      <Line
        ref={lineRef}
        points={[sensor.x, sensor.y, sensor.x2, sensor.y2]}
        stroke={baseColor}
        strokeWidth={strokeWidth}
        dash={baseDashed ? BEAM_DASH_PX : undefined}
        hitStrokeWidth={interactive ? hitStrokeWidth : 0}
        onClick={handleSelect}
        onTap={handleSelect}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      {/* Blocked overlay: committed-state only (accepted staleness mid-drag) - solid prefix up to the crossing, plus a small cross. */}
      {check.blockedAt && (
        <SensorBeamBlockedOverlay x1={sensor.x} y1={sensor.y} blockedAt={check.blockedAt} strokeWidth={strokeWidth} />
      )}

      <SensorBeamEndMarker
        groupRef={txRef}
        x={sensor.x}
        y={sensor.y}
        label={label}
        iconRadiusPx={iconRadiusPx}
        selected={selected}
        interactive={interactive}
        viewportScale={viewportScale}
        onSelect={handleSelect}
        onDragMove={handleEndDragMove('tx')}
        onDragEnd={handleEndDragEnd('tx')}
      />

      <SensorBeamEndMarker
        groupRef={rxRef}
        x={sensor.x2}
        y={sensor.y2}
        label="RX"
        iconRadiusPx={iconRadiusPx}
        selected={selected}
        interactive={interactive}
        viewportScale={viewportScale}
        onSelect={handleSelect}
        onDragMove={handleEndDragMove('rx')}
        onDragEnd={handleEndDragEnd('rx')}
      />
    </Group>
  )
})
