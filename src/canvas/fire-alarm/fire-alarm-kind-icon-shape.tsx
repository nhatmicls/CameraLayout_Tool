import { Circle, Line, Rect, RegularPolygon, Star, Wedge } from 'react-konva'
import type { FireAlarmKind } from '../../domain/fire-alarm/fire-alarm-device-types'

interface FireAlarmKindIconShapeProps {
  kind: FireAlarmKind
  /** Fill colour - `FIRE_ALARM_KIND_COLORS[kind]` (fire-alarm-kind-color-palette.ts). */
  tint: string
  /** Icon radius in *image* px - same sizing source as camera/sensor icons, `computeIconRadiusPx` (brand-and-dori-color-palette.ts). */
  radiusPx: number
}

const ICON_STROKE_COLOR = '#1f2937' // neutral-800, reads on any fire-alarm tint

/**
 * One simple, original geometric marker shape per fire-alarm kind (no
 * vendor artwork - same rule as `camera-form-factor-icon-shape.tsx` /
 * `sensor-kind-icon-shape.tsx`). Nine kinds, nine distinct silhouettes so a
 * dense plan still reads at a glance even before the label text: panel =
 * square, hub = circle, expander = diamond, keypad = hexagon, smoke =
 * octagon, heat = star, CO = pentagon, call point = triangle (the familiar
 * alert shape), sounder = a speaker-cone wedge. Deliberately listening - see
 * the equivalent note on `CameraFormFactorIconShape` for why a non-listening
 * icon would make the whole marker unselectable.
 */
export function FireAlarmKindIconShape({ kind, tint, radiusPx }: FireAlarmKindIconShapeProps) {
  const strokeWidth = Math.max(1, radiusPx * 0.12)
  const shared = { fill: tint, stroke: ICON_STROKE_COLOR, strokeWidth }

  switch (kind) {
    case 'control-panel':
      return <Rect x={-radiusPx} y={-radiusPx} width={radiusPx * 2} height={radiusPx * 2} {...shared} />

    case 'wireless-hub':
      return <Circle radius={radiusPx} {...shared} />

    case 'expander-module':
      return <Line points={[0, -radiusPx, radiusPx, 0, 0, radiusPx, -radiusPx, 0]} closed {...shared} />

    case 'keypad':
      return <RegularPolygon sides={6} radius={radiusPx} {...shared} />

    case 'smoke-detector':
      return <RegularPolygon sides={8} radius={radiusPx} {...shared} />

    case 'heat-detector':
      return <Star numPoints={5} innerRadius={radiusPx * 0.5} outerRadius={radiusPx} {...shared} />

    case 'co-detector':
      return <RegularPolygon sides={5} radius={radiusPx} {...shared} />

    case 'manual-call-point':
      return <RegularPolygon sides={3} radius={radiusPx} {...shared} />

    case 'sounder':
      return <Wedge radius={radiusPx} angle={270} rotation={-135} {...shared} />

    default: {
      // Exhaustiveness guard: FireAlarmKind in fire-alarm-device-types.ts is the source of truth.
      const exhaustive: never = kind
      throw new Error(`Unhandled fire-alarm kind: ${exhaustive}`)
    }
  }
}
