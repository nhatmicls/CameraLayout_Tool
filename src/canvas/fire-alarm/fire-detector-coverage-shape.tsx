import { memo, type RefObject } from 'react'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { WallSegment } from '../../domain/wall/wall-segment-geometry'
import { fireAlarmDeviceLiveHandleKey, type ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'
import { WallClippedCoverageShape } from '../shared/wall-clipped-coverage-shape'
import { FIRE_DETECTOR_STANDARD_CIRCLE_DASH } from './fire-alarm-kind-color-palette'

export interface FireDetectorCoverageShapeProps {
  device: PlacedFireAlarmDevice
  /** Standard-derived protection radius, metres (`resolveFireDetectorCoverage`). */
  radiusM: number
  color: string
  selected: boolean
  planPxPerMeter: number
  blockingWalls: readonly WallSegment[]
  wallClearancePx: number
  maxClipRadiusPx: number
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
}

/**
 * One fire detector's standard-derived coverage circle: a thin memoised
 * wrapper around the generic `WallClippedCoverageShape` that builds the
 * single-entry `bands` array internally, from primitive props (`radiusM`/
 * `color`) only. Without this, `fire-detector-coverage-shapes.tsx` would
 * pass a fresh `bands={[...]}` array every render, defeating
 * `WallClippedCoverageShape`'s own `memo` even for a device that did not
 * change. Twin of `sensor-coverage-shape.tsx`'s `SensorCoverageShape`
 * (that one resolves several bands; a fire detector only ever has one).
 */
export const FireDetectorCoverageShape = memo(function FireDetectorCoverageShape({
  device,
  radiusM,
  color,
  selected,
  planPxPerMeter,
  blockingWalls,
  wallClearancePx,
  maxClipRadiusPx,
  nodeRegistry,
}: FireDetectorCoverageShapeProps) {
  return (
    <WallClippedCoverageShape
      liveHandleKey={fireAlarmDeviceLiveHandleKey(device.id)}
      x={device.x}
      y={device.y}
      rotationDeg={0}
      angleDeg={360}
      maxRangeM={radiusM}
      bands={[{ key: 'coverage', innerM: 0, outerM: radiusM, color }]}
      dash={FIRE_DETECTOR_STANDARD_CIRCLE_DASH}
      selected={selected}
      planPxPerMeter={planPxPerMeter}
      blockingWalls={blockingWalls}
      wallClearancePx={wallClearancePx}
      maxClipRadiusPx={maxClipRadiusPx}
      nodeRegistry={nodeRegistry}
    />
  )
})
