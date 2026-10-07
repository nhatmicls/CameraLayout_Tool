import { memo } from 'react'
import type { PlacedCircleSensor, PlacedSectorSensor, SensorKind } from '../../domain/sensor/sensor-types'
import { DraggableIconMarkerNode } from '../shared/draggable-icon-marker-node'
import { SensorKindIconShape } from './sensor-kind-icon-shape'
import { SENSOR_MARKER_TINT } from './sensor-kind-color-palette'

export interface SensorMarkerNodeProps {
  sensor: PlacedSectorSensor | PlacedCircleSensor
  kind: SensorKind
  label: string
  iconRadiusPx: number
  selected: boolean
  rotationDeg?: number
  rotatable: boolean
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
 * One sector/circle sensor's marker: a thin memoised wrapper around the
 * generic `DraggableIconMarkerNode` that builds the sensor's icon element
 * internally, from primitive props (`kind` -> tint lookup) only. Without
 * this, `sensor-marker-nodes.tsx` would have to build `icon={<.../>}` itself
 * and pass it down as a prop - a fresh element every render, which defeats
 * `DraggableIconMarkerNode`'s own `memo` even for sensors that did not
 * change (an unrelated sibling sensor's move still re-renders the whole
 * `sensors[]`-mapped list). Keeping the icon construction INSIDE a memoised
 * component whose own props are primitives means this sensor's subtree is
 * skipped entirely when nothing about it changed. Twin of
 * `fire-alarm-marker-node.tsx`.
 */
export const SensorMarkerNode = memo(function SensorMarkerNode({
  sensor,
  kind,
  label,
  iconRadiusPx,
  selected,
  rotationDeg,
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
  return (
    <DraggableIconMarkerNode
      item={sensor}
      icon={<SensorKindIconShape kind={kind} tint={SENSOR_MARKER_TINT[kind]} radiusPx={iconRadiusPx} />}
      label={label}
      iconRadiusPx={iconRadiusPx}
      selected={selected}
      rotationDeg={rotationDeg}
      rotatable={rotatable}
      interactive={interactive}
      viewportScale={viewportScale}
      imageWidthPx={imageWidthPx}
      imageHeightPx={imageHeightPx}
      onSelect={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onRotateLive={onRotateLive}
      onRotateEnd={onRotateEnd}
    />
  )
})
