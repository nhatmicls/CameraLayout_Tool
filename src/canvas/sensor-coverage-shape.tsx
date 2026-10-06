import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import { Group } from 'react-konva'
import { coneSweepShape, sectorStartDeg } from '../domain/fov-cone-sector-geometry'
import { metersToPlanPx } from '../domain/scale-calibration-calculator'
import { resolveSensorAreaCoverage, type SensorCoverageBandKey } from '../domain/sensor-coverage-resolver'
import type { PlacedCircleSensor, PlacedSectorSensor, SensorModelSpec } from '../domain/sensor-types'
import type { ThermalDriZone } from '../domain/thermal-dri-band-calculator'
import { distancePointToSegmentPx, type WallSegment } from '../domain/wall-segment-geometry'
import {
  computeConeClipFunc,
  CONE_CLIP_STROKE_PAD_PX,
  sensorLiveHandleKey,
  type ConeLiveHandle,
} from './wall-occlusion-cone-clip'
import { CoverageBandArc } from './coverage-band-arc'
import { DORI_BAND_FILL_OPACITY, DORI_BAND_FILL_OPACITY_SELECTED } from './brand-and-dori-color-palette'
import { SENSOR_KIND_COLORS, THERMAL_DRI_BAND_COLORS } from './sensor-kind-color-palette'

export interface SensorCoverageShapeProps {
  sensor: PlacedSectorSensor | PlacedCircleSensor
  spec: SensorModelSpec
  /** Shared with `camera-fov-cones-layer.tsx`'s cones, keyed through `sensorLiveHandleKey`/`cameraLiveHandleKey` so a camera and a sensor that happen to share a raw id (possible in a hand-edited file) never collide (see `plan-scene-layers.tsx`). */
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
  planPxPerMeter: number
  selected: boolean
  /** Opaque-only or opaque+glass, already picked for this sensor's kind by the caller (`sensor-coverage-shapes.tsx`). Must keep its array identity while the walls are unchanged (it is a memo key here). */
  blockingWalls: readonly WallSegment[]
  wallClearancePx: number
  /** Image diagonal, image px - safety cap on the clip radius actually used for the wall-proximity filter below. A thermal sensor's datasheet range can be hundreds of metres, far past any floor plan; the visibility-polygon cost is driven by how many walls fall inside the clip radius, so capping at the image's own diagonal never considers a wall the image could not possibly contain. */
  maxClipRadiusPx: number
}

/**
 * Filters `walls` down to those within `radiusPx` of (`x`, `y`), but returns
 * the SAME array reference as the previous render when the result is
 * element-wise identical (same walls, same order) - so a `walls` identity
 * change that does not actually affect which walls are within range of THIS
 * sensor (e.g. a distant wall's edit) does not ripple into `occlusionInputs`/
 * `clipFunc` recomputing for it. Uses the React-documented
 * "adjust state during render" pattern (plain `useRef` mutation during
 * render is disallowed by this project's lint rules) - calling `setState`
 * conditionally here re-runs this render immediately with the corrected
 * value, it does not schedule a second commit.
 */
function useStableFilteredWalls(walls: readonly WallSegment[], x: number, y: number, radiusPx: number): readonly WallSegment[] {
  const filtered = useMemo(() => walls.filter((wall) => distancePointToSegmentPx(x, y, wall) <= radiusPx), [walls, x, y, radiusPx])
  const [previous, setPrevious] = useState(filtered)
  const unchanged = previous.length === filtered.length && previous.every((wall, i) => wall === filtered[i])
  if (!unchanged) {
    setPrevious(filtered)
    return filtered
  }
  return previous
}

/** A band keyed 'coverage' (PIR/vibration) is a single-colour kind tint; a thermal band is keyed by its D/R/I zone instead. */
function resolveBandColor(kind: SensorModelSpec['kind'], key: SensorCoverageBandKey): string {
  if (kind === 'thermal') return THERMAL_DRI_BAND_COLORS[key as ThermalDriZone]
  if (kind === 'pir' || kind === 'vibration') return SENSOR_KIND_COLORS[kind]
  // Unreachable: resolveSensorAreaCoverage returns null for a beam spec against a sector/circle sensor, so the component returns before this ever runs.
  return SENSOR_KIND_COLORS.beam
}

/**
 * One PIR/thermal/vibration sensor's coverage: a sector (PIR, thermal) or
 * circle (vibration), clipped by its kind-appropriate blocking walls. Same
 * two-Group / live-handle-registry structure as `camera-fov-cone-shape.tsx`
 * (outer Group at the sensor, unrotated, carries the clip; inner Group
 * carries the bearing), so a drag/rotate moves and re-clips this shape with
 * zero store writes and zero React re-renders mid-gesture, exactly like a
 * camera cone. Renders nothing when `spec`/`sensor.shape` do not correspond
 * (the caller's bug, not a user error - see `resolveSensorAreaCoverage`).
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
  const outerRef = useRef<Konva.Group>(null)
  const innerRef = useRef<Konva.Group>(null)

  const coverage = useMemo(() => resolveSensorAreaCoverage(spec, sensor), [spec, sensor])
  const rotationDeg = sensor.shape === 'sector' ? sensor.rotationDeg : 0
  const sweepShape = useMemo(() => coneSweepShape(coverage?.angleDeg ?? 0), [coverage])
  const localRotationDeg = useMemo(() => sectorStartDeg(0, coverage?.angleDeg ?? 0), [coverage])

  const clipRadiusPx = coverage ? metersToPlanPx(coverage.maxRangeM, planPxPerMeter) + CONE_CLIP_STROKE_PAD_PX : 0

  // Perf (measured with 100 sensors + 300 walls): a wall farther than this cone's own clip
  // radius can never be hit by any ray the visibility polygon casts, so excluding it before
  // the O(walls^2) math is what actually pays off. `clipRadiusPx` is still capped at the image
  // diagonal (`maxClipRadiusPx`) as a safety bound for a huge thermal range the image could
  // not possibly contain.
  //
  // `useStableFilteredWalls` (below) keeps the returned array's REFERENCE identical to the
  // previous one whenever its elements are unchanged, so editing a wall elsewhere on the plan
  // - which gives `blockingWalls` a new array identity every time - does not, by itself, force
  // this sensor's `occlusionInputs`/`clipFunc` to recompute (moved/edited walls keep their own
  // object identity too: see `moveWallNode`/`updateWall`).
  const effectiveFilterRadiusPx = Math.min(clipRadiusPx, maxClipRadiusPx)
  const nearbyBlockingWalls = useStableFilteredWalls(blockingWalls, sensor.x, sensor.y, effectiveFilterRadiusPx)
  const occlusionInputs = useMemo(
    () => ({ clipRadiusPx, opaqueWalls: nearbyBlockingWalls, clearancePx: wallClearancePx }),
    [clipRadiusPx, nearbyBlockingWalls, wallClearancePx],
  )
  const clipFunc = useMemo(() => computeConeClipFunc(sensor.x, sensor.y, occlusionInputs), [sensor.x, sensor.y, occlusionInputs])
  // Mirror for the live handle below, holding the FULL (unfiltered) `blockingWalls`, not the
  // committed-position-filtered `nearbyBlockingWalls` above: a drag can move the sensor far
  // enough that walls outside the pre-drag filter radius come into range, and
  // `computeConeClipFunc` (via `selectOccludingLocalSegments`) already drops out-of-range
  // walls on every call, so passing the full list costs nothing in correctness.
  const occlusionInputsRef = useRef({ clipRadiusPx, opaqueWalls: blockingWalls, clearancePx: wallClearancePx })
  useEffect(() => {
    occlusionInputsRef.current = { clipRadiusPx, opaqueWalls: blockingWalls, clearancePx: wallClearancePx }
  }, [clipRadiusPx, blockingWalls, wallClearancePx])

  useEffect(() => {
    const registry = nodeRegistry.current
    const key = sensorLiveHandleKey(sensor.id)
    registry.set(key, {
      moveTo: (pos) => {
        const outer = outerRef.current
        if (!outer) return
        outer.position(pos)
        outer.setAttr('clipFunc', computeConeClipFunc(pos.x, pos.y, occlusionInputsRef.current))
      },
      // No-op for a circle sensor (nothing ever calls it - circle has no rotation handle), harmless for a sector sensor whose angle is 360 (also handle-less).
      rotateTo: (deg) => {
        innerRef.current?.rotation(deg)
      },
    })
    return () => {
      registry.delete(key)
    }
  }, [nodeRegistry, sensor.id])

  if (!coverage) return null

  const fillOpacity = selected ? DORI_BAND_FILL_OPACITY_SELECTED : DORI_BAND_FILL_OPACITY
  const strokeWidth = selected ? 1.5 : 1

  return (
    <Group ref={outerRef} x={sensor.x} y={sensor.y} clipFunc={clipFunc} listening={false}>
      <Group ref={innerRef} rotation={rotationDeg}>
        {coverage.bands.map((band) => (
          <CoverageBandArc
            key={band.key}
            innerRadius={metersToPlanPx(band.innerM, planPxPerMeter)}
            outerRadius={metersToPlanPx(band.outerM, planPxPerMeter)}
            angleDeg={coverage.angleDeg}
            sweepShape={sweepShape}
            rotationDeg={localRotationDeg}
            color={resolveBandColor(spec.kind, band.key)}
            opacity={fillOpacity}
            strokeWidth={strokeWidth}
          />
        ))}
      </Group>
    </Group>
  )
})
