import { memo, type RefObject } from 'react'
import { resolveSensorAreaCoverage, type SensorCoverageBandKey } from '../../domain/sensor/sensor-coverage-resolver'
import type { PlacedCircleSensor, PlacedSectorSensor, SensorModelSpec } from '../../domain/sensor/sensor-types'
import type { ThermalDriZone } from '../../domain/sensor/thermal-dri-band-calculator'
import type { WallSegment } from '../../domain/wall/wall-segment-geometry'
import { sensorLiveHandleKey, type ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'
import { WallClippedCoverageShape } from '../shared/wall-clipped-coverage-shape'
import { SENSOR_KIND_COLORS, THERMAL_DRI_BAND_COLORS } from './sensor-kind-color-palette'

export interface SensorCoverageShapeProps {
  sensor: PlacedSectorSensor | PlacedCircleSensor
  spec: SensorModelSpec
  /** Shared with `camera-fov-cones-layer.tsx`'s cones, keyed through `sensorLiveHandleKey`/`cameraLiveHandleKey` so a camera and a sensor that happen to share a raw id (possible in a hand-edited file) never collide (see `plan-scene-layers.tsx`). */
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
  planPxPerMeter: number
  selected: boolean
  /** Opaque-only or opaque+glass, already picked for this sensor's kind by the caller (`sensor-coverage-shapes.tsx`). Must keep its array identity while the walls are unchanged (it is a memo key here, inside `WallClippedCoverageShape`). */
  blockingWalls: readonly WallSegment[]
  wallClearancePx: number
  /** Image diagonal, image px - forwarded as a safety cap on the clip radius actually used for the wall-proximity filter (see `wall-clipped-coverage-shape.tsx`). */
  maxClipRadiusPx: number
}

/** A band keyed 'coverage' (PIR/vibration) is a single-colour kind tint; a thermal band is keyed by its D/R/I zone instead. */
function resolveBandColor(kind: SensorModelSpec['kind'], key: SensorCoverageBandKey): string {
  if (kind === 'thermal') return THERMAL_DRI_BAND_COLORS[key as ThermalDriZone]
  if (kind === 'pir' || kind === 'vibration') return SENSOR_KIND_COLORS[kind]
  // Unreachable: resolveSensorAreaCoverage returns null for a beam spec against a sector/circle sensor, so the component returns before this ever runs.
  return SENSOR_KIND_COLORS.beam
}

/**
 * One PIR/thermal/vibration sensor's coverage: resolves the sensor's bands
 * and colours, then hands them to the generic `WallClippedCoverageShape`
 * (the camera-cone-shaped live-handle/occlusion wiring lives there now, not
 * here - this file used to BE that wiring before the fire-alarm phase
 * extracted it for a second caller). Renders nothing when `spec`/`sensor.shape`
 * do not correspond (the caller's bug, not a user error - see
 * `resolveSensorAreaCoverage`).
 */
export const SensorCoverageShape = memo(function SensorCoverageShape({
  sensor,
  spec,
  nodeRegistry,
  planPxPerMeter,
  selected,
  blockingWalls,
  wallClearancePx,
  maxClipRadiusPx,
}: SensorCoverageShapeProps) {
  const coverage = resolveSensorAreaCoverage(spec, sensor)
  if (!coverage) return null

  const rotationDeg = sensor.shape === 'sector' ? sensor.rotationDeg : 0
  const bands = coverage.bands.map((band) => ({
    key: band.key,
    innerM: band.innerM,
    outerM: band.outerM,
    color: resolveBandColor(spec.kind, band.key),
  }))

  return (
    <WallClippedCoverageShape
      liveHandleKey={sensorLiveHandleKey(sensor.id)}
      x={sensor.x}
      y={sensor.y}
      rotationDeg={rotationDeg}
      angleDeg={coverage.angleDeg}
      maxRangeM={coverage.maxRangeM}
      bands={bands}
      selected={selected}
      planPxPerMeter={planPxPerMeter}
      blockingWalls={blockingWalls}
      wallClearancePx={wallClearancePx}
      maxClipRadiusPx={maxClipRadiusPx}
      nodeRegistry={nodeRegistry}
    />
  )
})
