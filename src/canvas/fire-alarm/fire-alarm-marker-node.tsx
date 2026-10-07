import { memo } from 'react'
import type { FireAlarmKind, PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { DraggableIconMarkerNode } from '../shared/draggable-icon-marker-node'
import { FireAlarmKindIconShape } from './fire-alarm-kind-icon-shape'
import { FIRE_ALARM_KIND_COLORS } from './fire-alarm-kind-color-palette'

export interface FireAlarmMarkerNodeProps {
  device: PlacedFireAlarmDevice
  kind: FireAlarmKind
  label: string
  iconRadiusPx: number
  selected: boolean
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelect: (id: string) => void
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
}

/**
 * One fire-alarm device's marker: a thin memoised wrapper around the
 * generic `DraggableIconMarkerNode` that builds the device's icon element
 * internally, from a primitive `kind` prop (tint lookup) only. Twin of
 * `sensor-marker-node.tsx` - see that file's comment for why building the
 * icon element outside this boundary (in `fire-alarm-marker-nodes.tsx`)
 * would defeat `DraggableIconMarkerNode`'s own `memo`. No rotation handle:
 * a `PlacedFireAlarmDevice` has no bearing field.
 */
export const FireAlarmMarkerNode = memo(function FireAlarmMarkerNode({
  device,
  kind,
  label,
  iconRadiusPx,
  selected,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelect,
  onDragMove,
  onDragEnd,
}: FireAlarmMarkerNodeProps) {
  return (
    <DraggableIconMarkerNode
      item={device}
      icon={<FireAlarmKindIconShape kind={kind} tint={FIRE_ALARM_KIND_COLORS[kind]} radiusPx={iconRadiusPx} />}
      label={label}
      iconRadiusPx={iconRadiusPx}
      selected={selected}
      interactive={interactive}
      viewportScale={viewportScale}
      imageWidthPx={imageWidthPx}
      imageHeightPx={imageHeightPx}
      onSelect={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  )
})
