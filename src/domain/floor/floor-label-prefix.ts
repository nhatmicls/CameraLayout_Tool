/**
 * The project-wide BOM/CSV/PNG label prefix for one floor's items - always
 * `F{position}_` (1-based), e.g. `F2_C1` (underscore: owner decision, keeps
 * the floor apart from the `-` inside cable labels), even for a one-floor
 * project or a floor-scoped BOM view (owner decision 2026-10-09, phase 6 -
 * supersedes the earlier "empty for one floor" rule). The one place this
 * rule lives - `merge-bom-rows-across-floors.ts` calls it for
 * camera/sensor/fire-alarm/cabling-point BOM rows, and
 * `build-combined-bom-rows.ts` / `fire-alarm-device-label-by-id.ts` call it
 * directly for every row, project-wide or floor-filtered alike. A cable's
 * own label never goes through here: it already carries both its floors
 * from `cable-end-to-end-label.ts`, which uses this same function for each
 * end instead.
 */
export function floorPositionPrefix(floorIndex: number): string {
  return `F${floorIndex + 1}_`
}
