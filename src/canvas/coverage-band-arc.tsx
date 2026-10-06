import { Arc, Circle, Ring } from 'react-konva'
import type { ConeSweepShape } from '../domain/fov-cone-sector-geometry'

export interface CoverageBandArcProps {
  innerRadius: number
  outerRadius: number
  /** Full sweep angle in degrees - only meaningful for 'sector'/'half-disc'; ignored for 'full-circle'. */
  angleDeg: number
  sweepShape: ConeSweepShape
  /** Local rotation offset (the static half-angle start, independent of any live bearing), degrees - only meaningful for 'sector'/'half-disc'. */
  rotationDeg: number
  color: string
  opacity: number
  strokeWidth: number
}

/**
 * One coverage band: a Circle (full-circle sweep, zero inner radius), a Ring
 * (full-circle sweep, non-zero inner radius) or an Arc (sector/half-disc).
 * Extracted out of `camera-fov-cone-shape.tsx` (pure move - camera cones
 * render identically) so `sensor-coverage-shape.tsx` draws its
 * PIR/vibration/thermal bands with the same component instead of copying the
 * three-way shape choice.
 */
export function CoverageBandArc({
  innerRadius,
  outerRadius,
  angleDeg,
  sweepShape,
  rotationDeg,
  color,
  opacity,
  strokeWidth,
}: CoverageBandArcProps) {
  const shared = {
    fill: color,
    opacity,
    stroke: color,
    strokeWidth,
    // Perf: large scenes with many cameras/sensors stay interactive.
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  }

  if (sweepShape === 'full-circle') {
    return innerRadius === 0 ? (
      <Circle radius={outerRadius} {...shared} />
    ) : (
      <Ring innerRadius={innerRadius} outerRadius={outerRadius} {...shared} />
    )
  }

  // 'sector' and 'half-disc' both render as an Arc - half-disc is simply the angle=180 case.
  return <Arc innerRadius={innerRadius} outerRadius={outerRadius} angle={angleDeg} rotation={rotationDeg} {...shared} />
}
