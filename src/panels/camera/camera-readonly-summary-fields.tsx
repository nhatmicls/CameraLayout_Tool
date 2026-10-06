import type { CameraModel } from '../../catalog/camera/camera-catalog-loader'
import { audioLabel, detectionLabel, ipRateLabel } from '../../catalog/camera/camera-catalog-feature-labels'
import type { CameraLensSpec, PlacedCamera, ScaleCalibration } from '../../domain/project-file/project-types'
import { capitalizeFirstLetter } from '../shared/capitalize-first-letter'

interface CameraReadonlySummaryFieldsProps {
  camera: PlacedCamera
  model: CameraModel
  scale: ScaleCalibration | null
}

// The datasheet being silent on audio / detection is never a confirmed absence, so no "No".
const NOT_LISTED = 'not listed'

function lensLabel(lens: CameraLensSpec): string {
  return lens.kind === 'fixed' ? `${lens.focalMm} mm (fixed)` : `${lens.focalMinMm}-${lens.focalMaxMm} mm (varifocal)`
}

/**
 * The read-only half of the properties panel: catalog facts that come
 * straight from the selected camera's model record, plus its on-plan
 * position. Split out of `camera-properties-panel.tsx` to keep that file
 * under the project's line-count guideline.
 */
export function CameraReadonlySummaryFields({ camera, model, scale }: CameraReadonlySummaryFieldsProps) {
  const positionLabel = scale
    ? `${(camera.x / scale.planPxPerMeter).toFixed(2)} m, ${(camera.y / scale.planPxPerMeter).toFixed(2)} m`
    : `${camera.x.toFixed(0)} px, ${camera.y.toFixed(0)} px`

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
          <dt className="inline text-neutral-400">Form </dt>
          <dd data-testid="properties-form-factor" className="inline font-medium text-neutral-900">
            {capitalizeFirstLetter(model.formFactor)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Model </dt>
          <dd data-testid="properties-model" className="inline font-medium text-neutral-900">
            {model.model}
          </dd>
        </div>
        <div>
          <dt className="inline text-neutral-400">Resolution </dt>
          <dd data-testid="properties-resolution" className="inline font-medium text-neutral-900">
            {model.pixelWidth}x{model.pixelHeight} ({model.resolutionMp} MP)
          </dd>
        </div>
        <div>
          <dt className="inline text-neutral-400">Lens </dt>
          <dd data-testid="properties-lens" className="inline font-medium text-neutral-900">
            {lensLabel(model.lens)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Illumination </dt>
          <dd data-testid="properties-illumination-range" className="inline font-medium text-neutral-900">
            {model.illuminationRangeM !== null ? `${model.illuminationRangeM} m (datasheet)` : 'unpublished'}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">IP rate </dt>
          <dd data-testid="properties-protection" className="inline font-medium text-neutral-900">
            {ipRateLabel(model)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Audio </dt>
          <dd data-testid="properties-audio" className="inline font-medium text-neutral-900">
            {audioLabel(model) ?? NOT_LISTED}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="inline text-neutral-400">Detection </dt>
          <dd data-testid="properties-detection" className="inline font-medium text-neutral-900">
            {detectionLabel(model) ?? NOT_LISTED}
          </dd>
        </div>
      </dl>

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
