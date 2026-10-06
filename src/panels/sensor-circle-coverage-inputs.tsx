import type { ChangeEvent } from 'react'
import type { SensorModel } from '../catalog/sensor-catalog-loader'
import { resolveSensorAreaCoverage } from '../domain/sensor-coverage-resolver'
import type { PlacedCircleSensor, PlacedSensorPatch } from '../domain/sensor-types'
import { fieldLabelClass, inlineInputClass, secondaryButtonClass } from './camera-properties-form-helpers'
import { ClampedNumberInput } from './clamped-number-input'

interface SensorCircleCoverageInputsProps {
  sensor: PlacedCircleSensor
  /** vibration/glass-break - the only kind that draws as a `circle` (`sensorPlacementShape`; PIR has no circle shape, deviation 1). */
  model: Extract<SensorModel, { kind: 'vibration' }>
  onChange: (patch: PlacedSensorPatch) => void
}

/**
 * Circle editor for a vibration/glass-break sensor: a radius input clamped
 * to the largest printed radius, with a reset to the first printed row (the
 * same row `sensor-default-placement-builder.ts` picks on drop), plus a
 * preset select of every printed row (surface label as printed) when the
 * datasheet prints more than one. The radius input displays
 * `resolveSensorAreaCoverage`'s EFFECTIVE (clamped) value, matching what is
 * actually drawn rather than a possibly stale/above-datasheet stored value.
 */
export function SensorCircleCoverageInputs({ sensor, model, onChange }: SensorCircleCoverageInputsProps) {
  const largestRadiusM = Math.max(...model.radii.map((row) => row.radiusM))
  const defaultRadiusM = model.radii[0].radiusM
  const effectiveRadiusM = resolveSensorAreaCoverage(model, sensor)?.maxRangeM ?? sensor.radiusM

  const handlePresetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const radiusM = Number(e.target.value)
    if (Number.isFinite(radiusM)) onChange({ radiusM })
  }

  return (
    <>
      <label className={fieldLabelClass} htmlFor="properties-radius-input">
        Radius (m)
      </label>
      <div className="mt-1 flex gap-2">
        <ClampedNumberInput
          id="properties-radius-input"
          testId="properties-radius-input"
          min={0.1}
          max={largestRadiusM}
          step={0.1}
          value={effectiveRadiusM}
          onCommit={(radiusM) => onChange({ radiusM })}
          className={inlineInputClass}
        />
        <button
          type="button"
          data-testid="properties-radius-reset-button"
          onClick={() => onChange({ radiusM: defaultRadiusM })}
          className={`flex-shrink-0 ${secondaryButtonClass}`}
        >
          Reset
        </button>
      </div>

      {model.radii.length > 1 && (
        <>
          <label className={fieldLabelClass} htmlFor="properties-radius-preset-select">
            Datasheet preset
          </label>
          <select
            id="properties-radius-preset-select"
            data-testid="properties-radius-preset-select"
            value={effectiveRadiusM}
            onChange={handlePresetChange}
            className={`mt-1 ${inlineInputClass}`}
          >
            {model.radii.map((row) => (
              <option key={`${row.surface ?? 'unspecified'}-${row.radiusM}`} value={row.radiusM}>
                {row.radiusM} m{row.surface ? ` (${row.surface})` : ''}
              </option>
            ))}
          </select>
        </>
      )}
    </>
  )
}
