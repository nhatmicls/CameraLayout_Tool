import type { Floor } from '../../domain/floor/floor-types'

export interface BillOfMaterialsFloorFilterProps {
  floors: readonly Floor[]
  /** `'all'` or a real floor id - the caller falls back to `'all'` once the selected floor no longer exists. */
  selectedFloorId: string
  onChange: (floorId: string) => void
}

/**
 * The BOM panel's "All floors | F1 Name | ..." filter (plan decision d/f) -
 * panel-local state, shown by the caller only when the project has more
 * than one floor. Never changes the CSV or the saved project file; a
 * single-floor selection shows that floor's own, unprefixed rows.
 */
export function BillOfMaterialsFloorFilter({ floors, selectedFloorId, onChange }: BillOfMaterialsFloorFilterProps) {
  return (
    <select
      data-testid="bom-floor-filter"
      value={selectedFloorId}
      onChange={(event) => onChange(event.target.value)}
      className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-700 focus:outline focus:outline-2 focus:outline-blue-600"
    >
      <option value="all">All floors</option>
      {floors.map((floor, index) => (
        <option key={floor.id} value={floor.id}>
          F{index + 1} {floor.name}
        </option>
      ))}
    </select>
  )
}
