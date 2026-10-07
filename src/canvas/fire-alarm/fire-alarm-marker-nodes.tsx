import { fireAlarmModelById } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { FireAlarmMarkerNode } from './fire-alarm-marker-node'

export interface FireAlarmMarkerNodesProps {
  devices: PlacedFireAlarmDevice[]
  iconRadiusPx: number
  selectedFireAlarmDeviceId: string | null
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  onSelectFireAlarmDevice: (id: string) => void
  /**
   * Expected to also poke the shared live-handle registry (see
   * `plan-scene-layers.tsx`'s `handleFireAlarmDeviceDragMove`/`DragEnd`)
   * before/after calling back here, exactly like the camera/sensor
   * equivalents - this component never touches the registry directly.
   */
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
}

/**
 * Markers for every placed fire-alarm device, in `devices[]` order (the
 * fire-alarm twin of `sensor-marker-nodes.tsx`/`camera-marker-nodes.tsx`).
 * Labels are `F{n}`, independent of camera (`C{n}`) and sensor (`S{n}`)
 * labels. No rotation handle: a `PlacedFireAlarmDevice` has no bearing field
 * at all (CLAUDE.md - one placed shape, nothing to rotate or resize). A
 * device whose catalog model id is unknown (removed since save) is skipped.
 */
export function FireAlarmMarkerNodes({
  devices,
  iconRadiusPx,
  selectedFireAlarmDeviceId,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  onSelectFireAlarmDevice,
  onDragMove,
  onDragEnd,
}: FireAlarmMarkerNodesProps) {
  return (
    <>
      {devices.map((device, index) => {
        const spec = fireAlarmModelById(device.modelId)
        if (!spec) return null

        return (
          <FireAlarmMarkerNode
            key={device.id}
            device={device}
            kind={spec.kind}
            label={`F${index + 1}`}
            iconRadiusPx={iconRadiusPx}
            selected={device.id === selectedFireAlarmDeviceId}
            interactive={interactive}
            viewportScale={viewportScale}
            imageWidthPx={imageWidthPx}
            imageHeightPx={imageHeightPx}
            onSelect={onSelectFireAlarmDevice}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        )
      })}
    </>
  )
}
