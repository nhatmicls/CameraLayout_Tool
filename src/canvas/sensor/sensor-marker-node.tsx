import { memo } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Text } from 'react-konva'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import type { PlacedCircleSensor, PlacedSectorSensor, SensorKind } from '../../domain/sensor/sensor-types'
import { CameraRotationHandle } from '../camera/camera-rotation-handle'
import { SensorKindIconShape } from './sensor-kind-icon-shape'
import { SELECTION_RING_PADDING_PX } from '../shared/brand-and-dori-color-palette'

interface SensorMarkerNodeProps {
  sensor: PlacedSectorSensor | PlacedCircleSensor
  /** "S{n}", derived by the caller from the sensor's position in `sensors[]` - independent of camera labels. */
  label: string
  kind: Exclude<SensorKind, 'beam'>
  tint: string
  iconRadiusPx: number
  selected: boolean
  /** Sector sensors whose effective angle is 360deg (a full circle) have nothing to rotate - computed by the caller (`sensor-marker-nodes.tsx`) via `resolveSensorAreaCoverage`. Always false for a circle sensor. */
  rotatable: boolean
  /** False in export mode: no dragging, no selection ring, no rotation handle - a pure static render (see `plan-scene-layers.tsx`). */
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelect: (id: string) => void
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  onRotateLive: (id: string, rotationDeg: number) => void
  onRotateEnd: (id: string, rotationDeg: number) => void
}

/**
 * One PIR/thermal/vibration sensor's draggable icon + label (+ selection
 * ring, + rotation handle when selected/interactive/rotatable). Modelled on
 * `camera-marker-node.tsx`: same click-select with `cancelBubble`, same
 * `e.target === e.currentTarget` drag-bubble guard (the rotation handle is a
 * draggable child of this Group), same commit-time clamp to the image.
 * Lives in the markers Layer, paired with `sensor-coverage-shape.tsx` in the
 * cones Layer through the shared live-handle registry (`plan-scene-layers.tsx`).
 */
export const SensorMarkerNode = memo(function SensorMarkerNode({
  sensor,
  label,
  kind,
  tint,
  iconRadiusPx,
  selected,
  rotatable,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelect,
  onDragMove,
  onDragEnd,
  onRotateLive,
  onRotateEnd,
}: SensorMarkerNodeProps) {
  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true // don't let it reach the Stage's own "click empty area -> deselect" handler
    onSelect(sensor.id)
  }

  return (
    <Group
      x={sensor.x}
      y={sensor.y}
      draggable={interactive}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragMove={(e) => {
        if (e.target !== e.currentTarget) return // bubbled from the rotation handle
        onDragMove(sensor.id, { x: e.target.x(), y: e.target.y() })
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return
        const clamped = clampPointToImageBounds({ x: e.target.x(), y: e.target.y() }, imageWidthPx, imageHeightPx)
        e.target.position(clamped)
        onDragEnd(sensor.id, clamped)
      }}
    >
      <SensorKindIconShape kind={kind} tint={tint} radiusPx={iconRadiusPx} />

      {selected && (
        <Circle
          radius={iconRadiusPx + SELECTION_RING_PADDING_PX / viewportScale}
          stroke="#2563eb"
          strokeWidth={2 / viewportScale}
          listening={false}
        />
      )}

      <Text
        text={label}
        fontSize={Math.max(12, iconRadiusPx * 0.9)}
        fill="#111827"
        y={iconRadiusPx * 1.3}
        offsetX={label.length * Math.max(12, iconRadiusPx * 0.9) * 0.3}
        listening={false}
      />

      {selected && interactive && rotatable && sensor.shape === 'sector' && (
        <CameraRotationHandle
          rotationDeg={sensor.rotationDeg}
          viewportScale={viewportScale}
          onRotateLive={(deg) => onRotateLive(sensor.id, deg)}
          onRotateEnd={(deg) => onRotateEnd(sensor.id, deg)}
        />
      )}
    </Group>
  )
})
