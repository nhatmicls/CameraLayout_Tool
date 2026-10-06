import type { RefObject } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Group, Text } from 'react-konva'
import { SensorKindIconShape } from './sensor-kind-icon-shape'
import { SELECTION_RING_PADDING_PX } from './brand-and-dori-color-palette'
import { SENSOR_KIND_COLORS } from './sensor-kind-color-palette'

interface SensorBeamEndMarkerProps {
  groupRef: RefObject<Konva.Group | null>
  x: number
  y: number
  /** "S{n}" for the transmitter end, the literal "RX" for the receiver end. */
  label: string
  iconRadiusPx: number
  selected: boolean
  interactive: boolean
  viewportScale: number
  onSelect: (e: KonvaEventObject<Event>) => void
  onDragMove: (e: KonvaEventObject<DragEvent>) => void
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void
}

/**
 * One end (transmitter or receiver) of an active IR beam: icon + optional
 * selection ring + label. Split out of `sensor-beam-node.tsx` (used twice
 * there, once per end) to keep that file under the project's line-count
 * guideline - purely visual, all drag/commit logic stays in the caller.
 */
export function SensorBeamEndMarker({
  groupRef,
  x,
  y,
  label,
  iconRadiusPx,
  selected,
  interactive,
  viewportScale,
  onSelect,
  onDragMove,
  onDragEnd,
}: SensorBeamEndMarkerProps) {
  const fontSize = Math.max(12, iconRadiusPx * 0.9)

  return (
    <Group ref={groupRef} x={x} y={y} draggable={interactive} onClick={onSelect} onTap={onSelect} onDragMove={onDragMove} onDragEnd={onDragEnd}>
      <SensorKindIconShape kind="beam" tint={SENSOR_KIND_COLORS.beam} radiusPx={iconRadiusPx} />

      {selected && (
        <Circle
          radius={iconRadiusPx + SELECTION_RING_PADDING_PX / viewportScale}
          stroke="#2563eb"
          strokeWidth={2 / viewportScale}
          listening={false}
        />
      )}

      <Text text={label} fontSize={fontSize} fill="#111827" y={iconRadiusPx * 1.3} offsetX={label.length * fontSize * 0.3} listening={false} />
    </Group>
  )
}
