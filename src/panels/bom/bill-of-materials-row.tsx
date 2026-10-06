import { formatVndNumber, type BomRow } from '../../domain/bom/bill-of-materials-grouping'

interface BillOfMaterialsRowProps {
  row: BomRow
  /** Stable per-row id, see `bomRowSlug` in `bill-of-materials-panel.tsx`. */
  slug: string
  /** 'cameras' for a camera row (keeps the pre-existing `bom-cameras-*` testid); 'labels' for a sensor row (new `bom-labels-*` testid). */
  labelsTestIdPrefix: 'cameras' | 'labels'
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
      <td className="py-1 pr-2 text-right tabular-nums">{row.unitPriceVnd === null ? '—' : formatVndNumber(row.unitPriceVnd)}</td>
      <td data-testid={`bom-line-total-${slug}`} className="py-1 text-right tabular-nums">
        {row.lineTotalVnd === null ? '—' : formatVndNumber(row.lineTotalVnd)}
      </td>
    </tr>
  )
}
