import { Line, Rect, RegularPolygon } from 'react-konva'
import type { SensorKind } from '../../domain/sensor/sensor-types'

interface SensorKindIconShapeProps {
  kind: SensorKind
  /** Fill colour - `SENSOR_MARKER_TINT[kind]` (sensor-kind-color-palette.ts). */
  tint: string
  /** Icon radius in *image* px - same sizing source as camera icons, `computeIconRadiusPx` (brand-and-dori-color-palette.ts). */
  radiusPx: number
}

const ICON_STROKE_COLOR = '#1f2937' // neutral-800, reads on any sensor tint

/**
 * One simple, original geometric marker shape per sensor kind (no vendor
 * artwork - same rule as `camera-form-factor-icon-shape.tsx`). PIR = a
 * diamond, vibration = a triangle, thermal = a square, beam = a small
 * square (drawn once per end by `sensor-beam-node.tsx`, deliberately
 * smaller than the thermal square so the two never read as the same
 * marker). Deliberately listening - see the equivalent note on
 * `CameraFormFactorIconShape` for why a non-listening icon would make the
 * whole marker unselectable.
 */
export function SensorKindIconShape({ kind, tint, radiusPx }: SensorKindIconShapeProps) {
  const strokeWidth = Math.max(1, radiusPx * 0.12)

  switch (kind) {
    case 'pir':
      return (
        <Line
          points={[0, -radiusPx, radiusPx, 0, 0, radiusPx, -radiusPx, 0]}
          closed
          fill={tint}
          stroke={ICON_STROKE_COLOR}
          strokeWidth={strokeWidth}
        />
      )

    case 'vibration':
      return <RegularPolygon sides={3} radius={radiusPx} fill={tint} stroke={ICON_STROKE_COLOR} strokeWidth={strokeWidth} />

    case 'thermal':
      return (
        <Rect
          x={-radiusPx}
          y={-radiusPx}
          width={radiusPx * 2}
          height={radiusPx * 2}
          fill={tint}
          stroke={ICON_STROKE_COLOR}
          strokeWidth={strokeWidth}
        />
      )

    case 'beam':
      return (
        <Rect
          x={-radiusPx * 0.6}
          y={-radiusPx * 0.6}
          width={radiusPx * 1.2}
          height={radiusPx * 1.2}
          fill={tint}
          stroke={ICON_STROKE_COLOR}
          strokeWidth={strokeWidth}
        />
      )

    default: {
      // Exhaustiveness guard: SensorKind in sensor-types.ts is the source of truth.
      const exhaustive: never = kind
      throw new Error(`Unhandled sensor kind: ${exhaustive}`)
    }
  }
}
