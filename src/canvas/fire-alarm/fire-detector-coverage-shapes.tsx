import { useMemo, type RefObject } from 'react'
import { fireAlarmModelById } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { resolveFireDetectorCoverage } from '../../domain/fire-alarm/fire-detector-coverage-resolver'
import { FIRE_DETECTOR_BLOCKING_WALL_KINDS } from '../../domain/fire-alarm/fire-detector-wall-blocking-rules'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { Wall } from '../../domain/project-file/project-types'
import { selectBlockingWallSegments } from '../../domain/wall/wall-segment-geometry'
import type { ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'
import { FireDetectorCoverageShape } from './fire-detector-coverage-shape'
import { FIRE_ALARM_KIND_COLORS } from './fire-alarm-kind-color-palette'

export interface FireDetectorCoverageShapesProps {
  devices: PlacedFireAlarmDevice[]
  settings: FireAlarmSettings
  walls: Wall[]
  /** False (no scale set) draws nothing at all - CLAUDE.md's "no scale = no metres-derived shape" rule (cables' own wording) applies the same way here: a circle drawn against the `planPxPerMeter ?? 1` fallback would show a wrong radius with no indication it is wrong. */
  scaleIsSet: boolean
  planPxPerMeter: number
  selectedFireAlarmDeviceId: string | null
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
  wallClearancePx: number
  maxClipRadiusPx: number
}

/**
 * Coverage circles for every placed fire detector whose kind + the
 * project's `FireAlarmSettings` resolve to one
 * (`resolveFireDetectorCoverage` - today, only `tcvn-5738` mode, smoke/heat,
 * with a ceiling height inside the table). A non-detector kind, a device
 * with no resolvable circle, or an unknown catalog model id draws nothing.
 * Every circle is standard-derived (no shipped datasheet prints a
 * protection radius/area - `fire-detector-coverage-resolver.ts`), so it is
 * always drawn dashed (`FIRE_DETECTOR_STANDARD_CIRCLE_DASH`) to read as an
 * approximation, never a printed spec. Rendered as a fragment inside
 * `camera-fov-cones-layer.tsx`'s existing Layer (after
 * `SensorCoverageShapes`), like sensor coverage - zero extra Konva Layers.
 */
export function FireDetectorCoverageShapes({
  devices,
  settings,
  walls,
  scaleIsSet,
  planPxPerMeter,
  selectedFireAlarmDeviceId,
  nodeRegistry,
  wallClearancePx,
  maxClipRadiusPx,
}: FireDetectorCoverageShapesProps) {
  // All three detector kinds share the same blocking-wall list today (opaque+glass) - one
  // lookup, memoised once per `walls` change, same reasoning as `SensorCoverageShapes`' per-
  // kind-list memoisation.
  const blockingWalls = useMemo(
    () => selectBlockingWallSegments(walls, FIRE_DETECTOR_BLOCKING_WALL_KINDS['smoke-detector']),
    [walls],
  )

  if (!scaleIsSet) return null

  return (
    <>
      {devices.map((device) => {
        const spec = fireAlarmModelById(device.modelId)
        if (!spec) return null
        const coverage = resolveFireDetectorCoverage(spec, settings)
        if (!coverage) return null

        return (
          <FireDetectorCoverageShape
            key={device.id}
            device={device}
            radiusM={coverage.radiusM}
            color={FIRE_ALARM_KIND_COLORS[spec.kind]}
            selected={device.id === selectedFireAlarmDeviceId}
            planPxPerMeter={planPxPerMeter}
            blockingWalls={blockingWalls}
            wallClearancePx={wallClearancePx}
            maxClipRadiusPx={maxClipRadiusPx}
            nodeRegistry={nodeRegistry}
          />
        )
      })}
    </>
  )
}
