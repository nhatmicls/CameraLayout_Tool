import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type Konva from 'konva'
import { Group } from 'react-konva'
import { coneSweepShape, sectorStartDeg } from '../../domain/shared/fov-cone-sector-geometry'
import { metersToPlanPx } from '../../domain/shared/scale-calibration-calculator'
import { distancePointToSegmentPx, type WallSegment } from '../../domain/wall/wall-segment-geometry'
import { computeConeClipFunc, CONE_CLIP_STROKE_PAD_PX, type ConeLiveHandle } from '../wall/wall-occlusion-cone-clip'
import { CoverageBandArc } from './coverage-band-arc'
import { DORI_BAND_FILL_OPACITY, DORI_BAND_FILL_OPACITY_SELECTED } from './brand-and-dori-color-palette'

export interface WallClippedCoverageBand {
  key: string
  /** Metres from the origin, nearest edge of the band. */
  innerM: number
  /** Metres from the origin, farthest edge of the band. */
  outerM: number
  color: string
}

export interface WallClippedCoverageShapeProps {
  /** Shared live-handle registry key, already namespaced by the caller (`sensorLiveHandleKey`/`cameraLiveHandleKey`/`fireAlarmDeviceLiveHandleKey` - see `wall-occlusion-cone-clip.ts`). */
  liveHandleKey: string
  x: number
  y: number
  /** Local bearing, degrees - callers that have no bearing (a circle sensor, a fire-alarm device) pass 0. */
  rotationDeg: number
  /** Full sweep angle, degrees; 360 = a full circle. */
  angleDeg: number
  /** Outermost band's outer radius, metres - drives the clip radius. */
  maxRangeM: number
  bands: readonly WallClippedCoverageBand[]
  /** Stroke dash pattern (image px) applied to every band - a standard-derived (not datasheet) circle draws dashed. Omitted = solid. */
  dash?: number[]
  selected: boolean
  planPxPerMeter: number
  /** Already picked for this item's kind by the caller - opaque-only, or opaque+glass. Must keep its array identity while the walls are unchanged (it is a memo key here). */
  blockingWalls: readonly WallSegment[]
  wallClearancePx: number
  /** Image diagonal, image px - safety cap on the clip radius actually used for the wall-proximity filter below (see the equivalent note in the pre-extraction `sensor-coverage-shape.tsx`). */
  maxClipRadiusPx: number
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
}

/**
 * Filters `walls` down to those within `radiusPx` of (`x`, `y`), but returns
 * the SAME array reference as the previous render when the result is
 * element-wise identical - see the identical helper this was extracted from
 * in `sensor-coverage-shape.tsx`'s git history for the full rationale.
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

/**
 * Generic wall-clipped coverage shape: an unrotated outer Group at (`x`,`y`)
 * carrying the occlusion clip, an inner Group carrying the live bearing, and
 * one `CoverageBandArc` per band. Registers a `ConeLiveHandle` in
 * `nodeRegistry` under `liveHandleKey` so a marker drag/rotate can move and
 * re-clip this shape with zero store writes and zero React re-renders
 * mid-gesture - exactly like a camera cone.
 *
 * Extracted out of `sensor-coverage-shape.tsx` (pure move - sensor coverage
 * renders identically through that file's thin wrapper) so
 * `fire-detector-coverage-shapes.tsx` draws its single-band circle through
 * the same component instead of copying this file's live-handle/occlusion
 * wiring. Callers resolve their own coverage/colours and must not render this
 * component at all when there is nothing to draw (no early-return-null here:
 * every hook below is unconditional, so an empty `bands` array would still
 * mount two empty Groups).
 */
export const WallClippedCoverageShape = memo(function WallClippedCoverageShape({
  liveHandleKey,
  x,
  y,
  rotationDeg,
  angleDeg,
  maxRangeM,
  bands,
  dash,
  selected,
  planPxPerMeter,
  blockingWalls,
  wallClearancePx,
  maxClipRadiusPx,
  nodeRegistry,
}: WallClippedCoverageShapeProps) {
  const outerRef = useRef<Konva.Group>(null)
  const innerRef = useRef<Konva.Group>(null)

  const sweepShape = useMemo(() => coneSweepShape(angleDeg), [angleDeg])
  const localRotationDeg = useMemo(() => sectorStartDeg(0, angleDeg), [angleDeg])
  const clipRadiusPx = metersToPlanPx(maxRangeM, planPxPerMeter) + CONE_CLIP_STROKE_PAD_PX

  // Perf (measured with 100 sensors + 300 walls, see `sensor-coverage-shape.tsx`'s git history):
  // a wall farther than this shape's own clip radius can never be hit by any ray the visibility
  // polygon casts, so excluding it before the O(walls^2) math is what actually pays off.
  const effectiveFilterRadiusPx = Math.min(clipRadiusPx, maxClipRadiusPx)
  const nearbyBlockingWalls = useStableFilteredWalls(blockingWalls, x, y, effectiveFilterRadiusPx)
  const occlusionInputs = useMemo(
    () => ({ clipRadiusPx, opaqueWalls: nearbyBlockingWalls, clearancePx: wallClearancePx }),
    [clipRadiusPx, nearbyBlockingWalls, wallClearancePx],
  )
  const clipFunc = useMemo(() => computeConeClipFunc(x, y, occlusionInputs), [x, y, occlusionInputs])
  // Mirror for the live handle below, holding the FULL (unfiltered) `blockingWalls` - a drag can
  // move the item far enough that walls outside the pre-drag filter radius come into range.
  const occlusionInputsRef = useRef({ clipRadiusPx, opaqueWalls: blockingWalls, clearancePx: wallClearancePx })
  useEffect(() => {
    occlusionInputsRef.current = { clipRadiusPx, opaqueWalls: blockingWalls, clearancePx: wallClearancePx }
  }, [clipRadiusPx, blockingWalls, wallClearancePx])

  useEffect(() => {
    const registry = nodeRegistry.current
    registry.set(liveHandleKey, {
      moveTo: (pos) => {
        const outer = outerRef.current
        if (!outer) return
        outer.position(pos)
        outer.setAttr('clipFunc', computeConeClipFunc(pos.x, pos.y, occlusionInputsRef.current))
      },
      // No-op for a sweep with nothing to rotate (full circle) - harmless either way.
      rotateTo: (deg) => {
        innerRef.current?.rotation(deg)
      },
    })
    return () => {
      registry.delete(liveHandleKey)
    }
  }, [nodeRegistry, liveHandleKey])

  const fillOpacity = selected ? DORI_BAND_FILL_OPACITY_SELECTED : DORI_BAND_FILL_OPACITY
  const strokeWidth = selected ? 1.5 : 1

  return (
    <Group ref={outerRef} x={x} y={y} clipFunc={clipFunc} listening={false}>
      <Group ref={innerRef} rotation={rotationDeg}>
        {bands.map((band) => (
          <CoverageBandArc
            key={band.key}
            innerRadius={metersToPlanPx(band.innerM, planPxPerMeter)}
            outerRadius={metersToPlanPx(band.outerM, planPxPerMeter)}
            angleDeg={angleDeg}
            sweepShape={sweepShape}
            rotationDeg={localRotationDeg}
            color={band.color}
            opacity={fillOpacity}
            strokeWidth={strokeWidth}
            dash={dash}
          />
        ))}
      </Group>
    </Group>
  )
})
