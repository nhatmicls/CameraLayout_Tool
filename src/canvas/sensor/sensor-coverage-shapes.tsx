import { useMemo, type RefObject } from 'react'
import { sensorModelById } from '../../catalog/sensor/sensor-catalog-loader'
import type { Wall } from '../../domain/project-file/project-types'
import { SENSOR_BLOCKING_WALL_KINDS } from '../../domain/sensor/sensor-wall-blocking-rules'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { selectBlockingWallSegments, type WallSegment } from '../../domain/wall/wall-segment-geometry'
import { SensorCoverageShape } from './sensor-coverage-shape'
import type { ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'

export interface SensorCoverageShapesProps {
  sensors: PlacedSensor[]
  /** Sensors whose coverage shape the view config hides (`plan-view-visibility.ts`) - skipped, so the shape unmounts. */
  hiddenIds?: ReadonlySet<string>
  walls: Wall[]
  planPxPerMeter: number
  selectedSensorId: string | null
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
  wallClearancePx: number
  /** Image diagonal, image px - forwarded to each `SensorCoverageShape` as a safety cap on the wall-proximity filter radius. */
  maxClipRadiusPx: number
}

/**
 * Coverage shapes for every PIR / thermal / vibration sensor. Beams have no
 * area coverage (drawn by `sensor-beam-node.tsx` instead) and are skipped
 * here, along with any sensor whose catalog model id is unknown (removed
 * from the catalog since the project was saved). Rendered as a fragment, not
 * a Layer - mounted inside `camera-fov-cones-layer.tsx`'s existing Layer via
 * its `children` prop, so sensors cost zero extra Konva Layers.
 *
 * Memoises one blocking-wall list per DISTINCT kind-list found in
 * `SENSOR_BLOCKING_WALL_KINDS` (today: opaque-only for vibration, opaque+
 * glass for pir/thermal), once per `walls` change, exactly like
 * `camera-fov-cones-layer.tsx` does for cameras' single opaque-only list - a
 * sensor/camera move elsewhere in the scene never recomputes any of them.
 * Reads the kind-lists from `SENSOR_BLOCKING_WALL_KINDS` rather than
 * hardcoding them here, so a future edit to that table takes effect in this
 * memoisation too - `SENSOR_BLOCKING_WALL_KINDS` is meant to be the single
 * place the glass assumption lives.
 */
export function SensorCoverageShapes({
  sensors,
  hiddenIds,
  walls,
  planPxPerMeter,
  selectedSensorId,
  nodeRegistry,
  wallClearancePx,
  maxClipRadiusPx,
}: SensorCoverageShapesProps) {
  const blockingWallsByKindsKey = useMemo(() => {
    const byKindsKey = new Map<string, WallSegment[]>()
    for (const kinds of Object.values(SENSOR_BLOCKING_WALL_KINDS)) {
      const key = kinds.join(',')
      if (!byKindsKey.has(key)) byKindsKey.set(key, selectBlockingWallSegments(walls, kinds))
    }
    return byKindsKey
  }, [walls])

  // Draw the selected sensor's coverage last (on top), same reasoning as the camera cones' paint order.
  const sensorsInPaintOrder = useMemo(() => {
    if (!selectedSensorId) return sensors
    const rest = sensors.filter((s) => s.id !== selectedSensorId)
    const selected = sensors.find((s) => s.id === selectedSensorId)
    return selected ? [...rest, selected] : sensors
  }, [sensors, selectedSensorId])

  return (
    <>
      {sensorsInPaintOrder.map((sensor) => {
        if (sensor.shape === 'beam' || hiddenIds?.has(sensor.id)) return null
        const spec = sensorModelById(sensor.modelId)
        if (!spec || spec.kind === 'beam') return null

        const blockingKinds = SENSOR_BLOCKING_WALL_KINDS[spec.kind]
        // Always present: populated above from every kind-list the same table lists. The
        // fallback only satisfies the type checker, never actually taken.
        const blockingWalls = blockingWallsByKindsKey.get(blockingKinds.join(',')) ?? []

        return (
          <SensorCoverageShape
            key={sensor.id}
            sensor={sensor}
            spec={spec}
            nodeRegistry={nodeRegistry}
            planPxPerMeter={planPxPerMeter}
            selected={sensor.id === selectedSensorId}
            blockingWalls={blockingWalls}
            wallClearancePx={wallClearancePx}
            maxClipRadiusPx={maxClipRadiusPx}
          />
        )
      })}
    </>
  )
}
