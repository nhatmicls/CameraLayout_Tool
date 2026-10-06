import type { SensorModel } from '../../catalog/sensor/sensor-catalog-loader'
import type { ScaleCalibration } from '../../domain/project-file/project-types'
import { printedVfovDeg, SENSOR_KIND_LABELS, type PlacedSensor } from '../../domain/sensor/sensor-types'
import { capitalizeFirstLetter } from '../shared/capitalize-first-letter'
import { sensorCoverageSummary } from './sensor-coverage-summary-text'

interface SensorReadonlySummaryFieldsProps {
  sensor: PlacedSensor
  model: SensorModel
  scale: ScaleCalibration | null
}

/**
 * Read-only half of the sensor properties panel: catalog facts straight
 * from the selected sensor's model record, plus its on-plan position - the
 * sensor twin of `camera-readonly-summary-fields.tsx`. No DORI figure and
 * no computed VFOV ever appear here (CLAUDE.md) - the VFOV row only shows
 * when the datasheet prints one, labelled "as printed".
 */
export function SensorReadonlySummaryFields({ sensor, model, scale }: SensorReadonlySummaryFieldsProps) {
  const positionLabel = scale
    ? `${(sensor.x / scale.planPxPerMeter).toFixed(2)} m, ${(sensor.y / scale.planPxPerMeter).toFixed(2)} m`
    : `${sensor.x.toFixed(0)} px, ${sensor.y.toFixed(0)} px`
  const vfovDeg = printedVfovDeg(model)

  return (
    <>
      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-neutral-600">
        <div>
          <dt className="inline text-neutral-400">Brand </dt>
          <dd data-testid="properties-brand" className="inline font-medium text-neutral-900">
            {capitalizeFirstLetter(model.brand)}
          </dd>
        </div>
        <div>
          <dt className="inline text-neutral-400">Kind </dt>
          <dd data-testid="properties-kind" className="inline font-medium text-neutral-900">
            {SENSOR_KIND_LABELS[model.kind]}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Model </dt>
          <dd data-testid="properties-model" className="inline font-medium text-neutral-900">
            {model.model}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Coverage </dt>
          <dd data-testid="properties-coverage-summary" className="inline font-medium text-neutral-900">
            {sensorCoverageSummary(model)}
          </dd>
        </div>
        {vfovDeg !== undefined && (
          <div className="col-span-2">
            <dt className="inline text-neutral-400">VFOV </dt>
            <dd data-testid="properties-vfov" className="inline font-medium text-neutral-900">
              {vfovDeg}&deg; (as printed)
            </dd>
          </div>
        )}
      </dl>

      {model.convertedFromFeet && (
        <p data-testid="properties-converted-from-feet-note" className="mt-1 text-xs text-amber-700">
          Converted from a feet-only datasheet value.
        </p>
      )}

      <a
        href={model.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="properties-datasheet-link"
        className="mt-1 inline-block text-xs text-blue-600 hover:underline"
      >
        Datasheet
      </a>

      <p data-testid="properties-position" className="mt-3 text-xs text-neutral-500">
        Position: {positionLabel}
      </p>
    </>
  )
}
