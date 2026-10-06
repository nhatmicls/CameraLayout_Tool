import { clamp } from '../shared/clamp'
import { resolveBeamMaxDistanceM } from './sensor-coverage-resolver'
import { defaultBeamEnvironment, type PlacedSensor, type SensorModelSpec } from './sensor-types'

/** Thermal detection ranges run to hundreds of metres, far larger than a floor plan - cap the default, let the user raise it. */
export const THERMAL_DEFAULT_MAX_RANGE_M = 100

/** Default transmitter-to-receiver length for a freshly dropped beam, before clamping to the model's limit or the image bounds. */
export const BEAM_DEFAULT_LENGTH_M = 5

export interface BuildPlacedSensorAtDropInput {
  id: string
  modelId: string
  spec: SensorModelSpec
  /** Drop point, image px. */
  x: number
  y: number
  planPxPerMeter: number
  imageWidthPx: number
  imageHeightPx: number
}

/**
 * Builds the sensor placed at (x, y) when first dropped onto the canvas,
 * with kind-appropriate defaults so no zero-size/invisible sensor is ever
 * created: PIR gets its printed range; thermal is capped at
 * `THERMAL_DEFAULT_MAX_RANGE_M`; vibration gets its first printed radius
 * row; a beam's receiver sits `min(the model's limit, BEAM_DEFAULT_LENGTH_M)`
 * along whichever of +x/-x has more room from the drop point to the image
 * edge (never the fixed "always prefer -x when +x doesn't fully fit" rule,
 * which could collapse to a zero-length beam whenever the drop point was
 * ALSO near the left edge of a plan narrower than the default length),
 * clamped to the image either way. Pure function - the caller still runs
 * the result through the project store's `addSensor`.
 */
export function buildPlacedSensorAtDrop(input: BuildPlacedSensorAtDropInput): PlacedSensor {
  const { id, modelId, spec, x, y, planPxPerMeter, imageWidthPx, imageHeightPx } = input

  if (spec.kind === 'pir') {
    return { id, modelId, shape: 'sector', x, y, rotationDeg: 0, rangeM: spec.coverage.rangeM }
  }

  if (spec.kind === 'thermal') {
    const rangeM = Math.min(spec.detectionRangeM.human.detect, THERMAL_DEFAULT_MAX_RANGE_M)
    return { id, modelId, shape: 'sector', x, y, rotationDeg: 0, rangeM }
  }

  if (spec.kind === 'vibration') {
    return { id, modelId, shape: 'circle', x, y, radiusM: spec.radii[0].radiusM }
  }

  // beam
  const environment = defaultBeamEnvironment(spec)
  const { limitM } = resolveBeamMaxDistanceM(spec, environment)
  const lengthPx = Math.min(limitM, BEAM_DEFAULT_LENGTH_M) * planPxPerMeter
  // Whichever side of the drop point has more room to the image edge wins (ties go right,
  // matching the common case where the image is far bigger than the default length either
  // way) - never the fixed "try right, else always left" rule that could zero out the
  // length when the image was narrower than lengthPx AND x was also near the left edge.
  const roomRightPx = imageWidthPx - x
  const roomLeftPx = x
  const x2 = roomRightPx >= roomLeftPx ? clamp(x + lengthPx, 0, imageWidthPx) : clamp(x - lengthPx, 0, imageWidthPx)
  const y2 = clamp(y, 0, imageHeightPx)
  return { id, modelId, shape: 'beam', x, y, x2, y2, environment }
}
