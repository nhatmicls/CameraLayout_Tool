import { BOM_PRICE_TBD_TEXT, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { formatVndNumber } from '../../domain/bom/bom-price-formatting'

interface BillOfMaterialsRowProps {
  row: BomRow
  /** Stable per-row id, see `bomRowSlug` in `bill-of-materials-panel.tsx`. */
  slug: string
  /** 'cameras' for a camera row (keeps the pre-existing `bom-cameras-*` testid); 'labels' for a sensor row; 'fire-alarm' for a fire-alarm row; 'cabling-point' for a hub/riser/drop/shaft-opening row. */
  labelsTestIdPrefix: 'cameras' | 'labels' | 'fire-alarm' | 'cabling-point'
}

/** A row's price cell text: the literal "TBD" for a `priceTbd` row (owner decision 2026-10-09, phase 6), an em dash for a catalog model with no listed price, else the formatted amount. */
function priceCellText(amountVnd: number | null, priceTbd: boolean | undefined): string {
  if (priceTbd) return BOM_PRICE_TBD_TEXT
  return amountVnd === null ? '—' : formatVndNumber(amountVnd)
}

/** One BOM table row - shared by the camera and sensor tables in `bill-of-materials-panel.tsx` (extracted so that file stays under the project's line-count guideline). */
export function BillOfMaterialsRow({ row, slug, labelsTestIdPrefix }: BillOfMaterialsRowProps) {
  return (
    <tr data-testid={`bom-row-${slug}`} className="border-t border-neutral-100 text-neutral-700">
      <td className="py-1 pr-2">{row.brand}</td>
      <td className="py-1 pr-2 font-medium text-neutral-900">{row.model}</td>
      <td className="py-1 pr-2">{row.formFactor}</td>
      <td className="py-1 pr-2">{row.resolution}</td>
      <td className="py-1 pr-2">{row.lens}</td>
      <td data-testid={`bom-qty-${slug}`} className="py-1 pr-2">
        {row.quantity}
      </td>
      <td data-testid={`bom-${labelsTestIdPrefix}-${slug}`} className="py-1 pr-2 text-neutral-500">
        {row.labels}
      </td>
      <td className="py-1 pr-2 text-right tabular-nums">{priceCellText(row.unitPriceVnd, row.priceTbd)}</td>
      <td data-testid={`bom-line-total-${slug}`} className="py-1 text-right tabular-nums">
        {priceCellText(row.lineTotalVnd, row.priceTbd)}
      </td>
    </tr>
  )
}
