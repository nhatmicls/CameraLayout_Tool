/**
 * The project-wide BOM/CSV/PNG label prefix for one floor's items - empty
 * for a one-floor project (so that project's output stays byte-identical to
 * before multi-floor support), `F{position}_` (1-based) otherwise, e.g.
 * `F2_C1` (underscore: owner decision, keeps the floor apart from the `-` inside cable labels). The one place this rule lives - `merge-bom-rows-across-floors.ts`
 * and `project-cable-layout-estimate.ts`'s cable-total labels both call it.
 */
export function floorLabelPrefix(floorIndex: number, floorCount: number): string {
  return floorCount > 1 ? `F${floorIndex + 1}_` : ''
}
