import { Circle, Group, Line, Rect, RegularPolygon, Ring, Star, Wedge } from 'react-konva'
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
 * `sensor-kind-icon-shape.tsx`). Nineteen kinds, nineteen distinct
 * silhouettes so a dense plan still reads at a glance even before the label
 * text: panel = square, hub = circle, expander = diamond, keypad = hexagon,
 * smoke = octagon, heat = star, CO = pentagon, call point = triangle (the
 * familiar alert shape), sounder = a speaker-cone wedge; the nine kinds
 * added for the AX Hybrid PRO compatibility-list expansion get their own
 * shapes below (keyfob = rounded bar, tag reader = ring, relay module =
 * cross, repeater = concentric circles, communicator = half-moon wedge,
 * power supply = a bolt, accessory = a four-point star, magnetic contact =
 * two parallel plates, environment detector = an inverted triangle); the
 * datasheet-less intrusion detector = a quarter-circle fan.
 * Deliberately listening - see the equivalent note on
 * `CameraFormFactorIconShape` for why a non-listening icon would make the
 * whole marker unselectable.
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

    case 'keyfob':
      return <Rect x={-radiusPx * 0.55} y={-radiusPx} width={radiusPx * 1.1} height={radiusPx * 2} cornerRadius={radiusPx * 0.3} {...shared} />

    case 'tag-reader':
      return <Ring innerRadius={radiusPx * 0.45} outerRadius={radiusPx} {...shared} />

    case 'relay-module':
      return (
        <Group>
          <Rect x={-radiusPx} y={-radiusPx * 0.3} width={radiusPx * 2} height={radiusPx * 0.6} {...shared} />
          <Rect x={-radiusPx * 0.3} y={-radiusPx} width={radiusPx * 0.6} height={radiusPx * 2} {...shared} />
        </Group>
      )

    case 'repeater':
      return (
        <Group>
          <Circle radius={radiusPx} fill="transparent" stroke={ICON_STROKE_COLOR} strokeWidth={strokeWidth} />
          <Circle radius={radiusPx * 0.45} {...shared} />
        </Group>
      )

    case 'communicator':
      return <Wedge radius={radiusPx} angle={180} rotation={0} {...shared} />

    case 'power-supply':
      return (
        <Line
          points={[radiusPx * 0.2, -radiusPx, -radiusPx * 0.6, radiusPx * 0.15, 0, radiusPx * 0.15, -radiusPx * 0.2, radiusPx, radiusPx * 0.6, -radiusPx * 0.15, 0, -radiusPx * 0.15]}
          closed
          {...shared}
        />
      )

    case 'accessory':
      return <Star numPoints={4} innerRadius={radiusPx * 0.4} outerRadius={radiusPx} {...shared} />

    case 'magnetic-contact':
      return (
        <Group>
          <Rect x={-radiusPx} y={-radiusPx * 0.35} width={radiusPx * 0.75} height={radiusPx * 0.7} {...shared} />
          <Rect x={radiusPx * 0.25} y={-radiusPx * 0.35} width={radiusPx * 0.75} height={radiusPx * 0.7} {...shared} />
        </Group>
      )

    case 'environment-detector':
      return <RegularPolygon sides={3} radius={radiusPx} rotation={180} {...shared} />

    case 'intrusion-detector':
      return <Wedge y={radiusPx * 0.5} radius={radiusPx * 1.5} angle={90} rotation={-135} {...shared} />

    default: {
      // Exhaustiveness guard: FireAlarmKind in fire-alarm-device-types.ts is the source of truth.
      const exhaustive: never = kind
      throw new Error(`Unhandled fire-alarm kind: ${exhaustive}`)
    }
  }
}
