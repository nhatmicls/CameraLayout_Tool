import { Arc, Circle, Group, Line, Rect } from 'react-konva'
import type { FormFactor } from '../catalog/camera-catalog-schema'

interface CameraFormFactorIconShapeProps {
  formFactor: FormFactor
  /** Brand tint, applied to the icon body fill. */
  tint: string
  /** Icon radius in *image* px (see `brand-and-dori-color-palette.ts`). */
  radiusPx: number
}

const ICON_STROKE_COLOR = '#1f2937' // neutral-800, reads on any brand tint
const ICON_DETAIL_COLOR = '#ffffff'

/**
 * Five original, geometric form-factor icons built from Konva primitives
 * only (no vendor artwork/traced logos - see phase-05 security note).
 * Always drawn upright (never rotated with the camera's bearing - the cone
 * already shows direction).
 *
 * Deliberately listening (not `listening={false}`): this is the shape the
 * marker's `onClick`/drag actually hit-test against - Konva's
 * `listening={false}` excludes a node from hit-testing entirely rather than
 * "pass the hit to my parent", so marking this non-listening would make the
 * icon (and therefore the whole camera) unselectable and undraggable: a
 * click here would fall through everything (the cone layer is
 * non-listening too) straight to the Stage, which this app's "click empty
 * area deselects" handler then treats as an empty-canvas click.
 */
export function CameraFormFactorIconShape({ formFactor, tint, radiusPx }: CameraFormFactorIconShapeProps) {
  const strokeWidth = Math.max(1, radiusPx * 0.08)
  const detailStrokeWidth = strokeWidth * 0.7

  switch (formFactor) {
    case 'dome':
      // Circle body + a crescent highlight arc, suggesting a convex dome cover.
      return (
        <Group>
          <Circle radius={radiusPx} fill={tint} stroke={ICON_STROKE_COLOR} strokeWidth={strokeWidth} />
          <Arc
            innerRadius={0}
            outerRadius={radiusPx * 0.55}
            angle={130}
            rotation={205}
            fill={ICON_DETAIL_COLOR}
            opacity={0.45}
          />
        </Group>
      )

    case 'turret':
      // Circle body + an off-centre lens dot, suggesting the turret's angled lens module.
      return (
        <Group>
          <Circle radius={radiusPx} fill={tint} stroke={ICON_STROKE_COLOR} strokeWidth={strokeWidth} />
          <Circle x={radiusPx * 0.32} y={0} radius={radiusPx * 0.32} fill={ICON_STROKE_COLOR} />
        </Group>
      )

    case 'bullet':
      // Elongated rounded body + a lens cap at the front end.
      return (
        <Group>
          <Rect
            x={-radiusPx}
            y={-radiusPx * 0.55}
            width={radiusPx * 1.5}
            height={radiusPx * 1.1}
            cornerRadius={radiusPx * 0.3}
            fill={tint}
            stroke={ICON_STROKE_COLOR}
            strokeWidth={strokeWidth}
          />
          <Circle x={radiusPx * 0.5} y={0} radius={radiusPx * 0.45} fill={ICON_STROKE_COLOR} />
        </Group>
      )

    case 'fisheye':
      // Circle body + a concentric ring and crosshair, suggesting the panoramic lens.
      return (
        <Group>
          <Circle radius={radiusPx} fill={tint} stroke={ICON_STROKE_COLOR} strokeWidth={strokeWidth} />
          <Circle radius={radiusPx * 0.6} stroke={ICON_DETAIL_COLOR} strokeWidth={detailStrokeWidth} />
          <Line points={[-radiusPx * 0.35, 0, radiusPx * 0.35, 0]} stroke={ICON_DETAIL_COLOR} strokeWidth={detailStrokeWidth} />
          <Line points={[0, -radiusPx * 0.35, 0, radiusPx * 0.35]} stroke={ICON_DETAIL_COLOR} strokeWidth={detailStrokeWidth} />
        </Group>
      )

    case 'ptz':
      // Circle body + a lens dot inside a pan ring, suggesting the rotating head.
      return (
        <Group>
          <Circle radius={radiusPx} fill={tint} stroke={ICON_STROKE_COLOR} strokeWidth={strokeWidth} />
          <Arc
            innerRadius={radiusPx * 0.62}
            outerRadius={radiusPx * 0.62 + detailStrokeWidth}
            angle={270}
            rotation={45}
            fill={ICON_DETAIL_COLOR}
          />
          <Circle radius={radiusPx * 0.3} fill={ICON_STROKE_COLOR} />
        </Group>
      )

    default: {
      // Exhaustiveness guard: FORM_FACTORS in camera-catalog-schema.ts is the source of truth.
      const exhaustive: never = formFactor
      throw new Error(`Unhandled form factor: ${exhaustive}`)
    }
  }
}
