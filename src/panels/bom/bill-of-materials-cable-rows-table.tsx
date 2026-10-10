import type { BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { formatVndNumber } from '../../domain/bom/bom-price-formatting'

interface BillOfMaterialsCableRowsTableProps {
  /** One row per cable type in use (`groupCablesIntoBom`): quantity is whole metres to buy. */
  rows: BomRow[]
}

/**
 * The BOM panel's compact "Cables" table. Its own columns, not the camera /
 * sensor header: a cable row has no brand, form factor, resolution or lens,
 * and its quantity is metres.
 */
export function BillOfMaterialsCableRowsTable({ rows }: BillOfMaterialsCableRowsTableProps) {
  return (
    <table data-testid="bom-cables-table" className="w-full min-w-[400px] text-left text-xs">
      <thead>
        <tr className="text-neutral-400">
          <th className="pb-1 pr-2 font-normal">Cable type</th>
          <th className="pb-1 pr-2 text-right font-normal">Metres</th>
          <th className="pb-1 pr-2 font-normal">Labels</th>
          <th className="pb-1 pr-2 text-right font-normal">VND/m</th>
          <th className="pb-1 text-right font-normal">Total (VND)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          // Type names are user-typed and may repeat, so the row index is the key and the test id.
          <tr key={i} data-testid={`bom-cable-row-${i}`} className="border-t border-neutral-100 text-neutral-700">
            <td className="py-1 pr-2 font-medium text-neutral-900">{row.model}</td>
            <td data-testid={`bom-cable-qty-${i}`} className="py-1 pr-2 text-right tabular-nums">
              {row.quantity} {row.unit}
            </td>
            <td className="py-1 pr-2 text-neutral-500">{row.labels}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{row.unitPriceVnd === null ? '—' : formatVndNumber(row.unitPriceVnd)}</td>
            <td data-testid={`bom-cable-line-total-${i}`} className="py-1 text-right tabular-nums">
              {row.lineTotalVnd === null ? '—' : formatVndNumber(row.lineTotalVnd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
