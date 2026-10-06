/** Shared `<thead>` row for both the camera and sensor BOM tables in `bill-of-materials-panel.tsx`. No `Type` column in the panel - the panel itself uses "Cameras"/"Sensors" sub-headings instead (the 320px-wide sidebar has no room for an extra column; the PNG/CSV exports do carry the Type column, via `bomToTable`). */
export function BillOfMaterialsTableHeaderRow() {
  return (
    <tr className="text-neutral-400">
      <th className="pb-1 pr-2 font-normal">Brand</th>
      <th className="pb-1 pr-2 font-normal">Model</th>
      <th className="pb-1 pr-2 font-normal">Form</th>
      <th className="pb-1 pr-2 font-normal">Resolution</th>
      <th className="pb-1 pr-2 font-normal">Lens</th>
      <th className="pb-1 pr-2 font-normal">Qty</th>
      <th className="pb-1 pr-2 font-normal">Labels</th>
      <th className="pb-1 pr-2 text-right font-normal">Unit (VND)</th>
      <th className="pb-1 text-right font-normal">Total (VND)</th>
    </tr>
  )
}
