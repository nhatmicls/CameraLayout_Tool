import { memo, useMemo, useRef, useEffect, type RefObject } from 'react'
import type Konva from 'konva'
import { Arc, Circle, Group, Ring } from 'react-konva'
import { computeDoriBands } from '../domain/camera-coverage-resolver'
import { computeDoriDistancesM } from '../domain/dori-zone-distance-calculator'
import { coneSweepShape, sectorStartDeg } from '../domain/fov-cone-sector-geometry'
import { metersToPlanPx } from '../domain/scale-calibration-calculator'
import { DORI_BAND_COLORS, DORI_BAND_FILL_OPACITY, DORI_BAND_FILL_OPACITY_SELECTED } from './brand-and-dori-color-palette'

export interface CameraFovConeShapeProps {
  cameraId: string
  /** Shared registry this cone registers its Konva node into, so a sibling marker's drag/rotate can move it imperatively (see `plan-scene-layers.tsx`) with zero React re-renders and zero store writes mid-gesture. */
  nodeRegistry: RefObject<Map<string, Konva.Group | null>>
  x: number
  y: number
  rotationDeg: number
  pixelWidth: number
  hfovDeg: number
  rangeM: number
  planPxPerMeter: number
  selected: boolean
}

/**
 * One camera's FOV cone: bands from the domain's `computeDoriBands`,
 * converted to plan px via the calibrated scale. Non-listening (clicks
 * always pass through to the marker icon below/above it - see
 * `plan-scene-layers.tsx` for the two-layer z-order).
 *
 * Takes primitive inputs (`pixelWidth`/`hfovDeg`/`rangeM`), not a
 * pre-computed `bands` array, specifically so `React.memo` + the internal
 * `useMemo`s below can actually skip work for every camera except the one
 * that changed - an array literal recomputed by the parent every render
 * would defeat memoisation by always looking "new".
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
  planPxPerMeter,
  selected,
}: CameraFovConeShapeProps) {
  const nodeRef = useRef<Konva.Group>(null)

  useEffect(() => {
    const registry = nodeRegistry.current
    registry.set(cameraId, nodeRef.current)
    return () => {
      registry.delete(cameraId)
    }
  }, [nodeRegistry, cameraId])

  const distances = useMemo(() => computeDoriDistancesM(pixelWidth, hfovDeg), [pixelWidth, hfovDeg])
  const bands = useMemo(() => computeDoriBands(distances, rangeM), [distances, rangeM])
  const sweepShape = useMemo(() => coneSweepShape(hfovDeg), [hfovDeg])
  // The camera's own bearing lives on this Group's `rotation` (updated
  // imperatively during a rotation-handle drag); each band's *local*
  // rotation is the static half-HFOV offset only, independent of bearing.
  const localRotationDeg = useMemo(() => sectorStartDeg(0, hfovDeg), [hfovDeg])

  const fillOpacity = selected ? DORI_BAND_FILL_OPACITY_SELECTED : DORI_BAND_FILL_OPACITY
  const strokeWidth = selected ? 1.5 : 1

  return (
    <Group ref={nodeRef} x={x} y={y} rotation={rotationDeg} listening={false}>
      {bands.map((band) => {
        const color = DORI_BAND_COLORS[band.zone]
        const innerRadius = metersToPlanPx(band.innerM, planPxPerMeter)
        const outerRadius = metersToPlanPx(band.outerM, planPxPerMeter)
        const shared = {
          fill: color,
          opacity: fillOpacity,
          stroke: color,
          strokeWidth,
          // Perf (phase-05 step 11): large scenes with many cameras stay interactive.
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
        }

        if (sweepShape === 'full-circle') {
          return innerRadius === 0 ? (
            <Circle key={band.zone} radius={outerRadius} {...shared} />
          ) : (
            <Ring key={band.zone} innerRadius={innerRadius} outerRadius={outerRadius} {...shared} />
          )
        }

        // 'sector' and 'half-disc' both render as an Arc - half-disc is simply the angle=180 case.
        return (
          <Arc
            key={band.zone}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            angle={hfovDeg}
            rotation={localRotationDeg}
            {...shared}
          />
        )
      })}
    </Group>
  )
})
