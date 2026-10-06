import { cableTypeColor } from '../../canvas/cable/cable-type-color-palette'
import { formatVnd } from '../../domain/bom/bill-of-materials-grouping'
import { SCALE_NOT_SET_CABLE_MESSAGE, type CableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import type { CableType } from '../../domain/cable/cable-layout-types'
import { formatMetersInterval } from '../../domain/cable/cable-length-format'

interface CableEstimateTotalsTableProps {
  estimate: CableLayoutEstimate
  cableTypes: CableType[]
  cableCount: number
}

/**
 * Per-type cable totals: whole metres to buy, the estimate with its min-max
 * range, the line total (or "price on request"), then the grand total and
 * every warning. Pure presentation - every number comes from
 * `computeCableLayoutEstimate`, every length string from `cable-length-format.ts`.
 */
export function CableEstimateTotalsTable({ estimate, cableTypes, cableCount }: CableEstimateTotalsTableProps) {
  if (cableCount === 0) {
    return (
      <p data-testid="cable-estimate-empty-state" className="mt-1 text-xs text-neutral-400">
        No cables drawn yet.
      </p>
    )
  }
  if (!estimate.hasScale) {
    return (
      <p data-testid="cable-estimate-no-scale" className="mt-1 text-xs font-medium text-amber-600">
        {SCALE_NOT_SET_CABLE_MESSAGE}
      </p>
    )
  }

  return (
    <div className="mt-1 text-xs">
      {estimate.totals.map((total) => (
        <div key={total.type.id} data-testid={`cable-total-row-${total.type.id}`} className="mt-1.5 border-t border-neutral-100 pt-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-neutral-900">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: cableTypeColor(cableTypes.findIndex((type) => type.id === total.type.id)) }}
              />
              <span className="truncate">{total.type.name}</span>
              <span className="flex-shrink-0 font-normal text-neutral-400">x{total.cableCount}</span>
            </span>
            <span data-testid={`cable-total-buy-${total.type.id}`} className="flex-shrink-0 font-semibold tabular-nums text-neutral-900">
              {total.purchaseWholeM} m
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pl-4 text-neutral-500">
            <span data-testid={`cable-total-estimate-${total.type.id}`}>{formatMetersInterval(total.purchase)}</span>
            <span data-testid={`cable-total-price-${total.type.id}`} className="flex-shrink-0 tabular-nums">
              {total.lineTotalVnd === null ? 'price on request' : formatVnd(total.lineTotalVnd)}
            </span>
          </div>
        </div>
      ))}

      <p data-testid="cable-grand-total" className="mt-2 text-right font-semibold text-neutral-800">
        Cable total: {formatVnd(estimate.grandTotalVnd)}
        {estimate.unpricedTypeCount > 0 && (
          <span className="ml-1 font-normal text-neutral-500">
            (excludes {estimate.unpricedTypeCount} cable type{estimate.unpricedTypeCount === 1 ? '' : 's'} with no price)
          </span>
        )}
      </p>
      <p className="mt-0.5 text-right text-[10px] text-neutral-400">Provisional estimate incl. waste - measure on site before ordering.</p>

      {estimate.warnings.length > 0 && (
        <ul data-testid="cable-estimate-warnings" className="mt-2 list-disc space-y-0.5 pl-4 text-amber-700">
          {estimate.warnings.map((warning) => (
            <li key={`${warning.code}-${warning.cableId ?? ''}`}>{warning.message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
