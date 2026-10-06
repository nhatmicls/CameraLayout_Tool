import type { ChangeEvent } from 'react'
import type { SensorModel } from '../catalog/sensor-catalog-loader'
import { normalizeDegrees } from '../domain/fov-cone-sector-geometry'
import { THERMAL_DEFAULT_MAX_RANGE_M } from '../domain/sensor-default-placement-builder'
import { resolveSensorAreaCoverage } from '../domain/sensor-coverage-resolver'
import type { PlacedSectorSensor, PlacedSensorPatch } from '../domain/sensor-types'
import { fieldLabelClass, inlineInputClass, inputClass, secondaryButtonClass } from './camera-properties-form-helpers'
import { ClampedNumberInput } from './clamped-number-input'

interface SensorSectorCoverageInputsProps {
  sensor: PlacedSectorSensor
  /** pir or thermal - the only two kinds that draw as a `sector` (`sensorPlacementShape`). */
  model: Extract<SensorModel, { kind: 'pir' | 'thermal' }>
  onChange: (patch: PlacedSensorPatch) => void
}

/** The datasheet's own printed sweep angle - pir's printed `angleDeg`, or thermal's fixed `hfovDeg` (never a user override). */
function printedAngleDeg(model: SensorSectorCoverageInputsProps['model']): number {
  return model.kind === 'pir' ? model.coverage.angleDeg : model.hfovDeg
}

/** The datasheet's own printed range ceiling - pir's printed `rangeM`, or thermal's human detect distance. */
function printedMaxRangeM(model: SensorSectorCoverageInputsProps['model']): number {
  return model.kind === 'pir' ? model.coverage.rangeM : model.detectionRangeM.human.detect
}

/** The default range a freshly-dropped sensor of this model gets (`sensor-default-placement-builder.ts`) - what "Reset" restores. */
function defaultRangeM(model: SensorSectorCoverageInputsProps['model']): number {
  return model.kind === 'pir' ? model.coverage.rangeM : Math.min(model.detectionRangeM.human.detect, THERMAL_DEFAULT_MAX_RANGE_M)
}

/**
 * Sector editor shared by pir and thermal sensors: rotation, a range input
 * clamped to the datasheet ceiling (with reset), and - pir only - a sweep
 * angle override clamped to the printed angle (with reset). Thermal's angle
 * is never editable (its HFOV is fixed) and is shown read-only instead.
 * A sensor whose EFFECTIVE angle is 360 (a ceiling PIR left at its printed
 * angle) has no rotation input: a full circle looks the same at every
 * rotation. Keys off the EFFECTIVE angle, not the PRINTED one, so a ceiling
 * PIR whose angle override is reduced below 360 (now a real, orientable
 * sector) shows the rotation input - consistent with the canvas rotation
 * handle's own `coverage.angleDeg < 360` check (`sensor-marker-nodes.tsx`).
 * Both the range and angle inputs display `resolveSensorAreaCoverage`'s
 * EFFECTIVE (clamped) values too, matching what is actually drawn rather
 * than a possibly stale/above-datasheet stored value.
 */
export function SensorSectorCoverageInputs({ sensor, model, onChange }: SensorSectorCoverageInputsProps) {
  const printedAngle = printedAngleDeg(model)
  const coverage = resolveSensorAreaCoverage(model, sensor)
  const effectiveRangeM = coverage?.maxRangeM ?? sensor.rangeM
  const effectiveAngleDeg = coverage?.angleDeg ?? printedAngle
  const maxRangeM = printedMaxRangeM(model)
  const showRotation = effectiveAngleDeg < 360

  const handleRotationChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.valueAsNumber
    if (!Number.isFinite(raw)) return
    onChange({ rotationDeg: normalizeDegrees(raw) })
  }

  return (
    <>
      {showRotation && (
        <>
          <label className={fieldLabelClass} htmlFor="properties-rotation-input">
            Rotation (&deg;)
          </label>
          <input
            id="properties-rotation-input"
            data-testid="properties-rotation-input"
            type="number"
            min={0}
            max={359}
            step={1}
            value={Math.round(sensor.rotationDeg)}
            onChange={handleRotationChange}
            className={inputClass}
          />
        </>
      )}

      <label className={fieldLabelClass} htmlFor="properties-range-input">
        Range (m)
      </label>
      <div className="mt-1 flex gap-2">
        <ClampedNumberInput
          id="properties-range-input"
          testId="properties-range-input"
          min={0.1}
          max={maxRangeM}
          step={0.1}
          value={effectiveRangeM}
          onCommit={(rangeM) => onChange({ rangeM })}
          className={inlineInputClass}
        />
        <button
          type="button"
          data-testid="properties-range-reset-button"
          onClick={() => onChange({ rangeM: defaultRangeM(model) })}
          className={`flex-shrink-0 ${secondaryButtonClass}`}
        >
          Reset
        </button>
      </div>

      {model.kind === 'pir' ? (
        <>
          <label className={fieldLabelClass} htmlFor="properties-angle-input">
            Angle (&deg;)
          </label>
          <div className="mt-1 flex gap-2">
            <ClampedNumberInput
              id="properties-angle-input"
              testId="properties-angle-input"
              min={0.1}
              max={printedAngle}
              step={0.1}
              value={effectiveAngleDeg}
              onCommit={(angleDeg) => onChange({ angleDeg })}
              className={inlineInputClass}
            />
            <button
              type="button"
              data-testid="properties-angle-reset-button"
              onClick={() => onChange({ angleDeg: printedAngle })}
              className={`flex-shrink-0 ${secondaryButtonClass}`}
            >
              Reset
            </button>
          </div>
        </>
      ) : (
        <>
          <label className={fieldLabelClass}>Angle (&deg;)</label>
          <p data-testid="properties-angle-readonly" className="mt-1 text-sm text-neutral-700">
            {printedAngle}&deg; (datasheet HFOV, not editable)
          </p>
        </>
      )}
    </>
  )
}
