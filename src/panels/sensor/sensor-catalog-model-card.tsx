import type { DragEvent } from 'react'
import type { SensorModel } from '../../catalog/sensor/sensor-catalog-loader'
import { printedVfovDeg, SENSOR_KIND_LABELS } from '../../domain/sensor/sensor-types'
import { SENSOR_MODEL_DRAG_MIME_TYPE } from '../../canvas/sensor/use-sensor-drag-drop-target'
import { capitalizeFirstLetter } from '../shared/capitalize-first-letter'
import { IndicativePrice, PurchaseChannelRow } from '../shared/catalog-card-price-and-purchase-rows'
import { sensorCoverageSummary } from './sensor-coverage-summary-text'

interface SensorCatalogModelCardProps {
  model: SensorModel
  /** True until the plan's scale is calibrated - metre-based coverage is meaningless without one (same rule as the camera card). */
  disabled: boolean
}

/**
 * One sensor catalog card: brand, kind, model, coverage summary as printed
 * (`sensorCoverageSummary`), VFOV row only when the datasheet prints one, a
 * "converted from ft" note when the record was ft->m converted
 * (`convertedFromFeet`), a datasheet link, and price or "price on request" -
 * the sensor twin of `camera-catalog-model-card.tsx`. Drag starts the HTML5
 * drag-and-drop payload `use-sensor-drag-drop-target.ts`'s drop handler
 * expects; disabled (pre-calibration) cards don't start a drag at all.
 */
export function SensorCatalogModelCard({ model, disabled }: SensorCatalogModelCardProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(SENSOR_MODEL_DRAG_MIME_TYPE, model.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const vfovDeg = printedVfovDeg(model)

  return (
    <div
      data-testid={`sensor-catalog-card-${model.id}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      aria-disabled={disabled}
      title={disabled ? 'Calibrate the scale first to place sensors.' : `Drag onto the plan to place a ${model.model}`}
      className={`rounded border p-2 text-xs transition-colors ${
        disabled
          ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400'
          : 'cursor-grab border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:shadow-sm active:cursor-grabbing'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-800">{capitalizeFirstLetter(model.brand)}</span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">
          {SENSOR_KIND_LABELS[model.kind]}
        </span>
      </div>
      <p className="mt-1 font-medium text-neutral-900">{model.model}</p>
      <p data-testid={`sensor-catalog-coverage-${model.id}`} className="mt-0.5 text-neutral-500">
        {sensorCoverageSummary(model)}
      </p>
      {vfovDeg !== undefined && (
        <p data-testid={`sensor-catalog-vfov-${model.id}`} className="text-neutral-400">
          VFOV {vfovDeg}&deg; (as printed)
        </p>
      )}
      {model.convertedFromFeet && (
        <p data-testid={`sensor-catalog-converted-note-${model.id}`} className="text-amber-600">
          converted from ft
        </p>
      )}
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
        {!model.purchaseLinks && <IndicativePrice testId={`sensor-catalog-price-${model.id}`} priceVn={model.priceVn} />}
      </div>
      {model.purchaseLinks?.primary && (
        <PurchaseChannelRow testId={`sensor-catalog-buy-primary-${model.id}`} channel={model.purchaseLinks.primary} />
      )}
      {model.purchaseLinks?.secondary && (
        <PurchaseChannelRow testId={`sensor-catalog-buy-secondary-${model.id}`} channel={model.purchaseLinks.secondary} />
      )}
    </div>
  )
}
