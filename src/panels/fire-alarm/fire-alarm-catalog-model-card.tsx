import type { DragEvent } from 'react'
import type { FireAlarmModel } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { FIRE_ALARM_MODEL_DRAG_MIME_TYPE } from '../../canvas/fire-alarm/use-fire-alarm-device-drag-drop-target'
import { FIRE_ALARM_KIND_LABELS, isFireDetectorKind } from '../../domain/fire-alarm/fire-alarm-device-types'
import { brandDisplayLabel } from '../shared/brand-display-label'
import { IndicativePrice, PurchaseChannelRow } from '../shared/catalog-card-price-and-purchase-rows'
import { FireAlarmCompatibilityList } from './fire-alarm-compatibility-list'
import {
  FIRE_ALARM_NO_DATASHEET,
  FIRE_ALARM_PRODUCT_LINE_NOTES,
  FIRE_DETECTOR_PROTECTION_NOT_PRINTED,
} from './fire-alarm-ui-wording'

interface FireAlarmCatalogModelCardProps {
  model: FireAlarmModel
  /** True until the plan's scale is calibrated - same rule as the camera and sensor cards. */
  disabled: boolean
}

/**
 * One fire-alarm catalog card: brand, kind, model, product line (with its
 * fixed honesty note - AX devices are not a certified fire panel),
 * certifications as printed, capacity rows (controllers) or "protection
 * area: not printed" (detectors), a datasheet link (or "no datasheet"), price rows and the
 * catalog-level compatibility list. Drag starts the HTML5 payload
 * `use-fire-alarm-device-drag-drop-target.ts`'s drop handler expects.
 */
export function FireAlarmCatalogModelCard({ model, disabled }: FireAlarmCatalogModelCardProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(FIRE_ALARM_MODEL_DRAG_MIME_TYPE, model.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      data-testid={`fire-alarm-catalog-card-${model.id}`}
      draggable={!disabled}
      onDragStart={handleDragStart}
      aria-disabled={disabled}
      title={disabled ? 'Calibrate the scale first to place fire-alarm devices.' : `Drag onto the plan to place a ${model.model}`}
      className={`rounded border p-2 text-xs transition-colors ${
        disabled
          ? 'cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400'
          : 'cursor-grab border-neutral-200 bg-white text-neutral-700 hover:border-blue-300 hover:shadow-sm active:cursor-grabbing'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-800">{brandDisplayLabel(model.brand)}</span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500">
          {FIRE_ALARM_KIND_LABELS[model.kind]}
        </span>
      </div>
      <p className="mt-1 font-medium text-neutral-900">{model.model}</p>
      <p data-testid={`fire-alarm-catalog-product-line-${model.id}`} className="text-neutral-500">
        {model.productLine}
      </p>
      <p data-testid={`fire-alarm-catalog-product-line-note-${model.id}`} className="mt-0.5 text-amber-700">
        {FIRE_ALARM_PRODUCT_LINE_NOTES[model.productLine]}
      </p>

      {model.certificationsAsPrinted.length > 0 && (
        <p data-testid={`fire-alarm-catalog-certifications-${model.id}`} className="mt-0.5 text-neutral-500">
          Certifications: {model.certificationsAsPrinted.join(', ')}
        </p>
      )}

      {'capacityAsPrinted' in model && model.capacityAsPrinted.length > 0 && (
        <dl data-testid={`fire-alarm-catalog-capacity-${model.id}`} className="mt-1 text-neutral-500">
          {model.capacityAsPrinted.map((row) => (
            <div key={row.label}>
              <dt className="inline text-neutral-400">{row.label}: </dt>
              <dd className="inline">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {isFireDetectorKind(model.kind) && (
        <p data-testid={`fire-alarm-catalog-protection-${model.id}`} className="mt-0.5 text-neutral-400">
          {FIRE_DETECTOR_PROTECTION_NOT_PRINTED}
        </p>
      )}

      <div className="mt-1 flex items-baseline justify-between gap-2">
        {model.sourceUrl ? (
          <a
            href={model.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:underline"
          >
            datasheet
          </a>
        ) : (
          <span data-testid={`fire-alarm-catalog-no-datasheet-${model.id}`} className="text-neutral-400">
            {FIRE_ALARM_NO_DATASHEET}
          </span>
        )}
        {!model.purchaseLinks && <IndicativePrice testId={`fire-alarm-catalog-price-${model.id}`} priceVn={model.priceVn} />}
      </div>
      {model.purchaseLinks?.primary && (
        <PurchaseChannelRow testId={`fire-alarm-catalog-buy-primary-${model.id}`} channel={model.purchaseLinks.primary} />
      )}
      {model.purchaseLinks?.secondary && (
        <PurchaseChannelRow testId={`fire-alarm-catalog-buy-secondary-${model.id}`} channel={model.purchaseLinks.secondary} />
      )}

      <FireAlarmCompatibilityList model={model} />
    </div>
  )
}
