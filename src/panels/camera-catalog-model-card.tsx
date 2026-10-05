import type { DragEvent } from 'react'
import type { CameraModel, Lens } from '../catalog/camera-catalog-loader'
import { BRAND_TINTS } from '../canvas/brand-and-dori-color-palette'
import { formatVnd } from '../domain/bill-of-materials-grouping'
import { capitalizeFirstLetter } from './capitalize-first-letter'
import { CameraFeatureBadges } from './camera-feature-badges'

interface CameraCatalogModelCardProps {
  model: CameraModel
  /** True until the plan's scale is calibrated - a cone with no scale has a meaningless radius (see phase-05 Key Insights). */
  disabled: boolean
}

/** The custom MIME type carried by the HTML5 drag payload; `floor-plan-stage.tsx`'s drop handler reads only this. */
export const CAMERA_MODEL_DRAG_MIME_TYPE = 'application/x-camera-model-id'

function lensSummary(lens: Lens): string {
  return lens.kind === 'fixed' ? `${lens.focalMm} mm` : `${lens.focalMinMm}-${lens.focalMaxMm} mm`
}

function hfovSummary(lens: Lens): string {
  return lens.kind === 'fixed' ? `${lens.hfovDeg}°` : `${lens.hfovTeleDeg}°-${lens.hfovWideDeg}°`
}

/**
 * One catalog card: brand (text, no logo), model, form factor, resolution,
 * lens, HFOV, illumination range, a datasheet link, a row of protection/audio/
 * detection badges, and the indicative Vietnam price (linked to the reseller
 * page it was read from). Drag starts the HTML5 drag-and-drop payload the
 * stage's drop handler expects; disabled (pre-calibration) cards don't start
 * a drag at all.
 */
export function CameraCatalogModelCard({ model, disabled }: CameraCatalogModelCardProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(CAMERA_MODEL_DRAG_MIME_TYPE, model.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      data-testid={`catalog-card-${model.id}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      aria-disabled={disabled}
      title={disabled ? 'Calibrate the scale first to place cameras.' : `Drag onto the plan to place a ${model.model}`}
      style={{ borderLeftColor: BRAND_TINTS[model.brand], borderLeftWidth: 3 }}
      className={`rounded border p-2 text-xs transition-colors ${
        disabled
          ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400'
          : 'cursor-grab border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:shadow-sm active:cursor-grabbing'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-800">{capitalizeFirstLetter(model.brand)}</span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">{model.formFactor}</span>
      </div>
      <p className="mt-1 font-medium text-neutral-900">{model.model}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-neutral-500">
        <div>
          <dt className="inline">Lens </dt>
          <dd className="inline">{lensSummary(model.lens)}</dd>
        </div>
        <div>
          <dt className="inline">MP </dt>
          <dd className="inline">{model.resolutionMp}</dd>
        </div>
        <div>
          <dt className="inline">HFOV </dt>
          <dd className="inline">{hfovSummary(model.lens)}</dd>
        </div>
        <div>
          <dt className="inline">IR </dt>
          <dd className="inline">{model.illuminationRangeM ? `${model.illuminationRangeM} m` : 'unpublished'}</dd>
        </div>
      </dl>
      <CameraFeatureBadges model={model} />
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <a
          href={model.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-600 hover:underline"
        >
          datasheet
        </a>
        {model.priceVn ? (
          <a
            data-testid={`catalog-price-${model.id}`}
            href={model.priceVn.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Vietnam reseller price, checked ${model.priceVn.retrieved}`}
            className="font-semibold text-neutral-800 hover:underline"
          >
            ~{formatVnd(model.priceVn.amountVnd)}
          </a>
        ) : (
          <span className="text-neutral-400" title="No Vietnam reseller publishes a price for this model">
            price on request
          </span>
        )}
      </div>
    </div>
  )
}
