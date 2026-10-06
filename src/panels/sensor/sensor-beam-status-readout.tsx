import type { SensorModel } from '../../catalog/sensor/sensor-catalog-loader'
import { checkBeamLine } from '../../domain/beam/beam-sensor-line-check'
import { clampPointToImageBoundsAlongRay } from '../../domain/shared/clamp'
import { metersToPlanPx, planPxToMeters } from '../../domain/shared/scale-calibration-calculator'
import { resolveBeamMaxDistanceM } from '../../domain/sensor/sensor-coverage-resolver'
import { SENSOR_BLOCKING_WALL_KINDS } from '../../domain/sensor/sensor-wall-blocking-rules'
import { MIN_BEAM_LENGTH_PX, type PlacedBeamSensor, type PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import type { ScaleCalibration, Wall } from '../../domain/project-file/project-types'
import { selectBlockingWallSegments, WALL_MOUNT_CLEARANCE_M } from '../../domain/wall/wall-segment-geometry'
import { fieldLabelClass, inputClass } from '../camera/camera-properties-form-helpers'
import { ClampedNumberInput } from '../shared/clamped-number-input'

interface SensorBeamStatusReadoutProps {
  sensor: PlacedBeamSensor
  model: Extract<SensorModel, { kind: 'beam' }>
  scale: ScaleCalibration
  walls: readonly Wall[]
  imageWidthPx: number
  imageHeightPx: number
  onChange: (patch: PlacedSensorPatch) => void
}

/** Rounds to `decimals` places, so the length input shows a clean, editable number instead of the raw `planPxToMeters` float (e.g. "4.999999999999999" from a diagonal drag). */
function roundToDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const MIN_LENGTH_M = 0.5
const MAX_LENGTH_M = 500

/**
 * Beam editor: Indoor/Outdoor switch (hidden when the model prints only one
 * max distance), a length input that moves the receiver along the existing
 * transmitter-receiver direction, the printed max distance(s), and the
 * three line-of-sight messages from `checkBeamLine` - over-distance,
 * blocked by an opaque wall, crosses glass. The panel stays a form over
 * domain functions: `checkBeamLine` does the actual geometry, this
 * component only converts metres<->px for it and calls
 * `clampPointToImageBoundsAlongRay` for the length edit's direction-
 * preserving point math.
 */
export function SensorBeamStatusReadout({
  sensor,
  model,
  scale,
  walls,
  imageWidthPx,
  imageHeightPx,
  onChange,
}: SensorBeamStatusReadoutProps) {
  // Read the blocking set from the same table every sensor kind uses
  // (`SENSOR_BLOCKING_WALL_KINDS.beam`), not a separate, possibly-diverging selection.
  const opaqueWalls = selectBlockingWallSegments(walls, SENSOR_BLOCKING_WALL_KINDS.beam)
  const glassWalls = selectBlockingWallSegments(walls, ['glass'])
  const { limitM, outdoorM, indoorM } = resolveBeamMaxDistanceM(model, sensor.environment)
  const clearancePx = metersToPlanPx(WALL_MOUNT_CLEARANCE_M, scale.planPxPerMeter)
  const maxDistancePx = metersToPlanPx(limitM, scale.planPxPerMeter)

  const check = checkBeamLine({
    x1: sensor.x,
    y1: sensor.y,
    x2: sensor.x2,
    y2: sensor.y2,
    opaqueWalls,
    glassWalls,
    clearancePx,
    maxDistancePx,
  })
  const lengthMRaw = planPxToMeters(check.lengthPx, scale.planPxPerMeter)
  const roundedLengthM = roundToDecimals(lengthMRaw, 1)
  // Two decimals only when rounding to one would print the SAME number as the datasheet limit
  // while the beam is genuinely over it, so the length field and the "longer than..." warning
  // below never look contradictory (e.g. a true length of 100.04 m against a 100 m limit,
  // which at one decimal would round to "100.0" right next to "longer than 100 m").
  const lengthM = check.overMaxDistance && roundedLengthM === limitM ? roundToDecimals(lengthMRaw, 2) : roundedLengthM
  const showEnvironmentSwitch = outdoorM !== null && indoorM !== null

  const handleLengthChange = (newLengthM: number) => {
    const dx = sensor.x2 - sensor.x
    const dy = sensor.y2 - sensor.y
    const currentLengthPx = Math.hypot(dx, dy)
    const [ux, uy] = currentLengthPx > 0 ? [dx / currentLengthPx, dy / currentLengthPx] : [1, 0]
    const newLengthPx = metersToPlanPx(newLengthM, scale.planPxPerMeter)
    const rawPoint = { x: sensor.x + ux * newLengthPx, y: sensor.y + uy * newLengthPx }
    // Shortens along the beam's own direction instead of per-axis clamping, which can swing a
    // near-diagonal beam to a near-vertical/horizontal one once it reaches an image edge.
    const point = clampPointToImageBoundsAlongRay({ x: sensor.x, y: sensor.y }, rawPoint, imageWidthPx, imageHeightPx)
    // Refuse a typed length that would collapse the beam to under the minimum (e.g. the
    // transmitter is already on the image edge, aimed further out) - keep the previous receiver
    // instead of silently zeroing the beam out.
    if (Math.hypot(point.x - sensor.x, point.y - sensor.y) < MIN_BEAM_LENGTH_PX) return
    onChange({ x2: point.x, y2: point.y })
  }

  return (
    <>
      {showEnvironmentSwitch && (
        <>
          <label className={fieldLabelClass}>Environment</label>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              data-testid="properties-beam-environment-indoor"
              aria-pressed={sensor.environment === 'indoor'}
              onClick={() => onChange({ environment: 'indoor' })}
              className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
                sensor.environment === 'indoor' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-neutral-300 text-neutral-600'
              }`}
            >
              Indoor
            </button>
            <button
              type="button"
              data-testid="properties-beam-environment-outdoor"
              aria-pressed={sensor.environment === 'outdoor'}
              onClick={() => onChange({ environment: 'outdoor' })}
              className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
                sensor.environment === 'outdoor' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-neutral-300 text-neutral-600'
              }`}
            >
              Outdoor
            </button>
          </div>
        </>
      )}

      <label className={fieldLabelClass} htmlFor="properties-beam-length-input">
        Length (m)
      </label>
      <ClampedNumberInput
        id="properties-beam-length-input"
        testId="properties-beam-length-input"
        min={MIN_LENGTH_M}
        max={MAX_LENGTH_M}
        step={0.1}
        value={lengthM}
        onCommit={handleLengthChange}
        className={inputClass}
      />

      <p data-testid="properties-beam-datasheet-max" className="mt-2 text-xs text-neutral-500">
        Datasheet max: {outdoorM !== null ? `${outdoorM} m outdoor` : null}
        {outdoorM !== null && indoorM !== null ? ', ' : null}
        {indoorM !== null ? `${indoorM} m indoor` : null}
      </p>

      {check.overMaxDistance && (
        <p data-testid="properties-beam-over-distance-warning" className="mt-1.5 text-xs text-amber-700">
          Longer than the datasheet maximum ({limitM} m {sensor.environment}).
        </p>
      )}
      {check.blockedAt && (
        <p data-testid="properties-beam-blocked-warning" className="mt-1.5 text-xs text-red-700">
          Blocked by a wall.
        </p>
      )}
      {check.crossesGlass && (
        <p data-testid="properties-beam-glass-note" className="mt-1.5 text-xs text-neutral-500">
          Crosses glass - allowed for an IR beam, check on site.
        </p>
      )}
    </>
  )
}
