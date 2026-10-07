import { useMemo } from 'react'
import { sensorModelById } from '../../catalog/sensor/sensor-catalog-loader'
import type { Wall } from '../../domain/project-file/project-types'
import { resolveSensorAreaCoverage } from '../../domain/sensor/sensor-coverage-resolver'
import { SENSOR_BLOCKING_WALL_KINDS } from '../../domain/sensor/sensor-wall-blocking-rules'
import type { PlacedSensor, PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import { selectBlockingWallSegments } from '../../domain/wall/wall-segment-geometry'
import { SensorBeamNode } from '../beam/sensor-beam-node'
import { SensorMarkerNode } from './sensor-marker-node'

export interface SensorMarkerNodesProps {
  sensors: PlacedSensor[]
  walls: Wall[]
  /**
   * `onDragMove`/`onDragEnd`/`onRotateLive`/`onRotateEnd` below are expected
   * to also poke the shared live-handle registry (see
   * `plan-scene-layers.tsx`'s `handleSensorDragMove` etc.) before/after
   * calling back here - this component never touches the registry directly,
   * only `SensorCoverageShape` and `SensorMarkerNode`'s rotation handle do.
   */
  iconRadiusPx: number
  planPxPerMeter: number
  selectedSensorId: string | null
  interactive: boolean
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
  wallClearancePx: number
  onSelectSensor: (id: string) => void
  onDragMove: (id: string, pos: { x: number; y: number }) => void
  onDragEnd: (id: string, pos: { x: number; y: number }) => void
  onRotateLive: (id: string, rotationDeg: number) => void
  onRotateEnd: (id: string, rotationDeg: number) => void
  onCommit: (id: string, patch: PlacedSensorPatch) => void
}

/**
 * Markers for every placed sensor, in `sensors[]` order: sector/circle
 * sensors get `SensorMarkerNode` (drives the shared live-handle registry,
 * exactly like a camera marker), beams get `SensorBeamNode` (self-contained,
 * no registry - see that file). Labels are `S{n}` from the sensor's position
 * in `sensors[]`, independent of camera labels; a beam's receiver is always
 * "RX" (drawn by `SensorBeamNode` itself). A sensor whose catalog model id
 * is unknown (removed since save) is skipped.
 */
export function SensorMarkerNodes({
  sensors,
  walls,
  iconRadiusPx,
  planPxPerMeter,
  selectedSensorId,
  interactive,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
  wallClearancePx,
  onSelectSensor,
  onDragMove,
  onDragEnd,
  onRotateLive,
  onRotateEnd,
  onCommit,
}: SensorMarkerNodesProps) {
  // A beam's "blocking" set comes from the same table every other sensor kind reads
  // (`SENSOR_BLOCKING_WALL_KINDS.beam`), not a hardcoded `['opaque']` literal - glassWalls is a
  // separate, deliberately table-independent selection (every glass wall, for the "crosses
  // glass" note `beam-sensor-line-check.ts` reports; glass never blocks a beam).
  const opaqueWalls = useMemo(() => selectBlockingWallSegments(walls, SENSOR_BLOCKING_WALL_KINDS.beam), [walls])
  const glassWalls = useMemo(() => selectBlockingWallSegments(walls, ['glass']), [walls])

  return (
    <>
      {sensors.map((sensor, index) => {
        const spec = sensorModelById(sensor.modelId)
        if (!spec) return null
        const label = `S${index + 1}`
        const selected = sensor.id === selectedSensorId

        if (sensor.shape === 'beam') {
          if (spec.kind !== 'beam') return null
          return (
            <SensorBeamNode
              key={sensor.id}
              sensor={sensor}
              spec={spec}
              label={label}
              iconRadiusPx={iconRadiusPx}
              selected={selected}
              interactive={interactive}
              viewportScale={viewportScale}
              imageWidthPx={imageWidthPx}
              imageHeightPx={imageHeightPx}
              planPxPerMeter={planPxPerMeter}
              opaqueWalls={opaqueWalls}
              glassWalls={glassWalls}
              wallClearancePx={wallClearancePx}
              onSelect={onSelectSensor}
              onCommit={onCommit}
            />
          )
        }

        if (spec.kind === 'beam') return null
        // A sector sensor whose effective angle is a full circle (360deg) has nothing to rotate - hide the handle.
        const coverage = resolveSensorAreaCoverage(spec, sensor)
        const rotatable = sensor.shape === 'sector' && coverage !== null && coverage.angleDeg < 360

        return (
          <SensorMarkerNode
            key={sensor.id}
            sensor={sensor}
            kind={spec.kind}
            label={label}
            iconRadiusPx={iconRadiusPx}
            selected={selected}
            rotationDeg={sensor.shape === 'sector' ? sensor.rotationDeg : undefined}
            rotatable={rotatable}
            interactive={interactive}
            viewportScale={viewportScale}
            imageWidthPx={imageWidthPx}
            imageHeightPx={imageHeightPx}
            onSelect={onSelectSensor}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onRotateLive={onRotateLive}
            onRotateEnd={onRotateEnd}
          />
        )
      })}
    </>
  )
}
