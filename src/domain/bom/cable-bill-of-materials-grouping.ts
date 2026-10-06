import type { CableLayoutEstimate } from '../cable/cable-layout-estimate'
import type { BomRow, BomTotal } from './bill-of-materials-grouping'

/**
 * One BOM row per cable type that has at least one cable, in the project's
 * cable-type order: quantity = whole metres to buy (unit `m`), price = the
 * user's VND per metre. Empty when the estimate has no scale - without a
 * scale there are no metres, and a row's quantity is always a number.
 */
export function groupCablesIntoBom(estimate: CableLayoutEstimate): BomRow[] {
  return estimate.totals.map((total) => ({
    type: 'Cable',
    brand: '',
    model: total.type.name,
    formFactor: '',
    resolution: '',
    lens: '',
    quantity: total.purchaseWholeM,
    unit: 'm',
    labels: total.labels.join(', '),
    unitPriceVnd: total.type.pricePerMeterVnd,
    lineTotalVnd: total.lineTotalVnd,
  }))
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

/**
 * What the grand total leaves out, e.g. "excludes 2 items with no listed
 * price and 1 cable type with no price"; empty when everything is priced.
 * Items (pieces) and cable types (metres) are counted apart - metres must
 * never be added to an item count.
 */
export function formatBomUnpricedNote(total: BomTotal): string {
  const parts: string[] = []
  if (total.unpricedQuantity > 0) parts.push(`${plural(total.unpricedQuantity, 'item')} with no listed price`)
  if (total.unpricedCableTypeCount > 0) parts.push(`${plural(total.unpricedCableTypeCount, 'cable type')} with no price`)
  return parts.length > 0 ? `excludes ${parts.join(' and ')}` : ''
}
