import type { BomRow } from './bill-of-materials-grouping'
import { combineFireAlarmNotes, prefixFireAlarmNoteLabels } from './fire-alarm-bill-of-materials-grouping'

export interface FloorBomRows {
  /** `floorLabelPrefix(floorIndex, floorCount)` - `''` for a one-floor project, else e.g. `'F2_'`. */
  prefix: string
  rows: BomRow[]
}

/** Two rows merge when this returns true. Default: same (type, brand, model, lens) - the same grouping key `groupCamerasIntoBom`/`groupSensorsIntoBom`/`groupFireAlarmDevicesIntoBom` already use within one floor. */
export type BomRowMergeKey = (row: BomRow) => string

const defaultMergeKey: BomRowMergeKey = (row) => `${row.type}\u0000${row.brand}\u0000${row.model}\u0000${row.lens}`

/** `'C1, C3'` -> `'F2_C1, F2_C3'`; unchanged when `prefix` is `''`. */
function prefixLabels(labels: string, prefix: string): string {
  if (!prefix) return labels
  return labels
    .split(', ')
    .map((label) => `${prefix}${label}`)
    .join(', ')
}

function addLineTotals(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b
}

/** Row order after merging - the SAME comparator the single-floor grouper already sorted its own output with (`compareCameraBomRows`/`compareSensorBomRows`/`compareFireAlarmBomRows`), so a merge never reorders what a one-floor project would already show. */
export type BomRowCompare = (a: BomRow, b: BomRow) => number

/**
 * Merges camera / sensor / fire-alarm BOM rows from several floors into one
 * project-wide list (plan decision f): the same model (by `mergeKey`) on two
 * floors becomes one row, quantity and line total summed, labels
 * concatenated in floor order with each floor's own `prefix` applied first -
 * empty for a one-floor project, so that project's rows come out
 * byte-identical to before this plan. A fire-alarm row's `notes` carries
 * floor-prefixed device labels too, combined the same way; every other
 * row's `notes` stays absent (`undefined`), matching today's camera/sensor
 * rows exactly. Cable rows never pass through here - the project cable
 * estimate already sums and floor-prefixes them (`project-cable-layout-estimate.ts`).
 *
 * `compare`, when given, re-sorts the merged result (H2 review fix: without
 * it, a merge keeps first-appearance order, which can silently differ from
 * what the single-floor grouper's OWN sort would produce - e.g. an Axis row
 * appearing only on floor 2 would sort after a Hikvision row from floor 1
 * instead of before it alphabetically). Passing the exact comparator the
 * row's own family already sorts by means a ONE-floor merge is a no-op
 * re-sort (stable `Array.prototype.sort`), so the one-floor regression
 * still holds without a special case.
 */
export function mergeBomRowsAcrossFloors(
  perFloor: readonly FloorBomRows[],
  mergeKey: BomRowMergeKey = defaultMergeKey,
  compare?: BomRowCompare,
): BomRow[] {
  const merged: BomRow[] = []
  const indexByKey = new Map<string, number>()

  for (const { prefix, rows } of perFloor) {
    for (const row of rows) {
      const key = mergeKey(row)
      const labels = prefixLabels(row.labels, prefix)
      const notes = row.notes === undefined ? undefined : prefixFireAlarmNoteLabels(row.notes, prefix)

      const existingIndex = indexByKey.get(key)
      if (existingIndex === undefined) {
        indexByKey.set(key, merged.length)
        merged.push(notes === undefined ? { ...row, labels } : { ...row, labels, notes })
        continue
      }

      const existing = merged[existingIndex]
      const combinedNotes = combineFireAlarmNotes(existing.notes, notes)
      merged[existingIndex] = {
        ...existing,
        quantity: existing.quantity + row.quantity,
        labels: `${existing.labels}, ${labels}`,
        lineTotalVnd: addLineTotals(existing.lineTotalVnd, row.lineTotalVnd),
        ...(combinedNotes === undefined ? {} : { notes: combinedNotes }),
      }
    }
  }

  if (compare) merged.sort(compare)
  return merged
}
