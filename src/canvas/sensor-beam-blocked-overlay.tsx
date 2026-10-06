import { Line } from 'react-konva'
import { BEAM_BLOCKED_COLOR } from './sensor-kind-color-palette'

interface SensorBeamBlockedOverlayProps {
  /** Transmitter position, image px. */
  x1: number
  y1: number
  /** Nearest opaque-wall crossing, image px. */
  blockedAt: { x: number; y: number }
  strokeWidth: number
}

/** Half-length (image px) of the small cross drawn at the crossing point. */
const BLOCKED_CROSS_HALF_PX = 6

/**
 * The "blocked" half of a beam's three-state line: a solid segment from the
 * transmitter to the opaque-wall crossing (painted over the base line's full
 * dash so the pre-crossing stretch reads solid - see `sensor-beam-node.tsx`)
 * plus a small cross marking the crossing itself. Split out purely to keep
 * that file under the project's line-count guideline; non-listening
 * throughout - the base `Line` is still what selects the beam.
 */
export function SensorBeamBlockedOverlay({ x1, y1, blockedAt, strokeWidth }: SensorBeamBlockedOverlayProps) {
  const shared = { stroke: BEAM_BLOCKED_COLOR, strokeWidth, listening: false, perfectDrawEnabled: false, shadowForStrokeEnabled: false }

  return (
    <>
      <Line points={[x1, y1, blockedAt.x, blockedAt.y]} {...shared} />
      <Line
        points={[
          blockedAt.x - BLOCKED_CROSS_HALF_PX,
          blockedAt.y - BLOCKED_CROSS_HALF_PX,
          blockedAt.x + BLOCKED_CROSS_HALF_PX,
          blockedAt.y + BLOCKED_CROSS_HALF_PX,
        ]}
        {...shared}
      />
      <Line
        points={[
          blockedAt.x - BLOCKED_CROSS_HALF_PX,
          blockedAt.y + BLOCKED_CROSS_HALF_PX,
          blockedAt.x + BLOCKED_CROSS_HALF_PX,
          blockedAt.y - BLOCKED_CROSS_HALF_PX,
        ]}
        {...shared}
      />
    </>
  )
}
