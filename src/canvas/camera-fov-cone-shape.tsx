import { memo, useMemo, useRef, useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { Group } from 'react-konva'
import { computeDoriBands } from '../domain/camera-coverage-resolver'
import { computeDoriDistancesM } from '../domain/dori-zone-distance-calculator'
import { coneSweepShape, sectorStartDeg } from '../domain/fov-cone-sector-geometry'
import { computeMountedGroundCoverage } from '../domain/mounted-camera-ground-coverage-calculator'
import { metersToPlanPx } from '../domain/scale-calibration-calculator'
import type { WallSegment } from '../domain/wall-segment-geometry'
import { cameraLiveHandleKey, computeConeClipFunc, CONE_CLIP_STROKE_PAD_PX, type ConeLiveHandle } from './wall-occlusion-cone-clip'
import { CoverageBandArc } from './coverage-band-arc'
import { DORI_BAND_COLORS, DORI_BAND_FILL_OPACITY, DORI_BAND_FILL_OPACITY_SELECTED } from './brand-and-dori-color-palette'

export interface CameraFovConeShapeProps {
  cameraId: string
  /** Shared registry this cone registers a live handle into, so a sibling marker's drag/rotate can move (and re-clip) it imperatively (see `plan-scene-layers.tsx`) with zero React re-renders and zero store writes mid-gesture. */
  nodeRegistry: RefObject<Map<string, ConeLiveHandle>>
  x: number
  y: number
  rotationDeg: number
  pixelWidth: number
  hfovDeg: number
  rangeM: number
  /** Lens height above the floor, metres. undefined = flat cone from the camera out to `rangeM` (no height model). */
  mountHeightM?: number
  tiltDeg?: number
  /** Effective VFOV in degrees; null when not applicable (HFOV >= 180 without a datasheet value). Ignored when `mountHeightM` is undefined. */
  vfovDeg: number | null
  planPxPerMeter: number
  selected: boolean
  /** Opaque walls, image px. Must keep its array identity while the walls are unchanged (it is a memo key here). */
  opaqueWalls: readonly WallSegment[]
  /** Walls nearer than this to the camera do not block it (its mounting wall), image px. */
  wallClearancePx: number
}

/**
 * One camera's FOV cone: bands from the domain's `computeDoriBands` (or,
 * for a camera with a mount height, `computeMountedGroundCoverage`, whose
 * bands start at the blind-spot radius and end at the floor far edge),
 * converted to plan px via the calibrated scale. Non-listening (clicks
 * always pass through to the marker icon below/above it - see
 * `plan-scene-layers.tsx` for the two-layer z-order).
 *
 * Two nested Groups: the outer one sits at the camera, unrotated, and
 * carries the wall-occlusion clip (the visibility polygon is in unrotated
 * image axes); the inner one carries the bearing and the bands. Rotating
 * the camera therefore never touches the clip. With no opaque wall in range
 * there is no clip at all and the cone draws exactly as before walls existed.
 *
 * Takes primitive inputs (`pixelWidth`/`hfovDeg`/`rangeM`/mounting), not a
 * pre-computed `bands` array, specifically so `React.memo` + the internal
 * `useMemo`s below can actually skip work for every camera except the one
 * that changed - an array literal recomputed by the parent every render
 * would defeat memoisation by always looking "new". `opaqueWalls` is the
 * exception: an array, but one whose identity only changes when a wall does.
 */
export const CameraFovConeShape = memo(function CameraFovConeShape({
  cameraId,
  nodeRegistry,
  x,
  y,
  rotationDeg,
  pixelWidth,
  hfovDeg,
  rangeM,
  mountHeightM,
  tiltDeg,
  vfovDeg,
  planPxPerMeter,
  selected,
  opaqueWalls,
  wallClearancePx,
}: CameraFovConeShapeProps) {
  const outerRef = useRef<Konva.Group>(null)
  const innerRef = useRef<Konva.Group>(null)

  const distances = useMemo(() => computeDoriDistancesM(pixelWidth, hfovDeg), [pixelWidth, hfovDeg])
  const bands = useMemo(
    () =>
      mountHeightM === undefined
        ? computeDoriBands(distances, rangeM)
        : computeMountedGroundCoverage({
            mountHeightM,
            tiltDeg: tiltDeg ?? 0,
            vfovDeg,
            hfovDeg,
            rangeM,
            doriSlantM: distances,
          }).bands,
    [distances, rangeM, mountHeightM, tiltDeg, vfovDeg, hfovDeg],
  )
  const sweepShape = useMemo(() => coneSweepShape(hfovDeg), [hfovDeg])

  const clipRadiusPx =
    bands.length === 0
      ? 0
      : metersToPlanPx(Math.max(...bands.map((band) => band.outerM)), planPxPerMeter) + CONE_CLIP_STROKE_PAD_PX
  const occlusionInputs = useMemo(
    () => ({ clipRadiusPx, opaqueWalls, clearancePx: wallClearancePx }),
    [clipRadiusPx, opaqueWalls, wallClearancePx],
  )
  const clipFunc = useMemo(() => computeConeClipFunc(x, y, occlusionInputs), [x, y, occlusionInputs])
  // Mirror for the live handle below, so a drag always clips against the current walls / range.
  const occlusionInputsRef = useRef(occlusionInputs)
  useEffect(() => {
    occlusionInputsRef.current = occlusionInputs
  }, [occlusionInputs])

  useEffect(() => {
    const registry = nodeRegistry.current
    const key = cameraLiveHandleKey(cameraId)
    registry.set(key, {
      moveTo: (pos) => {
        const outer = outerRef.current
        if (!outer) return
        outer.position(pos)
        // Same function as the memo above: after dragend the React prop and this imperative value agree.
        outer.setAttr('clipFunc', computeConeClipFunc(pos.x, pos.y, occlusionInputsRef.current))
      },
      rotateTo: (deg) => {
        innerRef.current?.rotation(deg)
      },
    })
    return () => {
      registry.delete(key)
    }
  }, [nodeRegistry, cameraId])

  // The camera's own bearing lives on the inner Group's `rotation` (updated
  // imperatively during a rotation-handle drag); each band's *local*
  // rotation is the static half-HFOV offset only, independent of bearing.
  const localRotationDeg = useMemo(() => sectorStartDeg(0, hfovDeg), [hfovDeg])

  const fillOpacity = selected ? DORI_BAND_FILL_OPACITY_SELECTED : DORI_BAND_FILL_OPACITY
  const strokeWidth = selected ? 1.5 : 1

  return (
    <Group ref={outerRef} x={x} y={y} clipFunc={clipFunc} listening={false}>
      <Group ref={innerRef} rotation={rotationDeg}>
        {bands.map((band) => (
          <CoverageBandArc
            key={band.zone}
            innerRadius={metersToPlanPx(band.innerM, planPxPerMeter)}
            outerRadius={metersToPlanPx(band.outerM, planPxPerMeter)}
            angleDeg={hfovDeg}
            sweepShape={sweepShape}
            rotationDeg={localRotationDeg}
            color={DORI_BAND_COLORS[band.zone]}
            opacity={fillOpacity}
            strokeWidth={strokeWidth}
          />
        ))}
      </Group>
    </Group>
  )
})
