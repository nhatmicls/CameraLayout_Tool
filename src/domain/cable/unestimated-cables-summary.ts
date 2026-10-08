import type { CableEstimateWarning } from './cable-layout-estimate'

/**
 * The one place "a cable was excluded from the estimate" gets worded into a
 * summary line - the BOM panel, the CSV export's notification and the PNG
 * legend all call this, so an unestimated cross-floor cable can never just
 * silently vanish from one surface while still being counted (or not) on
 * another. Phase 7 (shafts) adds its own "no exit chosen" reason by adding
 * one entry to `REASON_LABELS` - none of the three call sites need to change.
 */
const REASON_LABELS: Partial<Record<CableEstimateWarning['code'], string>> = {
  'linked-floor-scale-not-set': 'a linked floor has no scale set',
  'link-cycle': 'its cross-floor route forms a cycle',
}

/**
 * "N cable(s) not estimated: <reason> (<n>); <reason> (<n>)." - counts are
 * broken down by reason when `warnings` carries one of `REASON_LABELS`'
 * codes with a `cableId`; falls back to a plain count if not. `null` when
 * `count` is 0 (nothing to say).
 */
export function describeUnestimatedCables(count: number, warnings: readonly CableEstimateWarning[]): string | null {
  if (count <= 0) return null
  const countByReason = new Map<string, number>()
  for (const warning of warnings) {
    if (warning.cableId === undefined) continue
    const label = REASON_LABELS[warning.code]
    if (label) countByReason.set(label, (countByReason.get(label) ?? 0) + 1)
  }
  const noun = count === 1 ? 'cable' : 'cables'
  const breakdown = Array.from(countByReason, ([label, n]) => `${label} (${n})`).join('; ')
  return breakdown ? `${count} ${noun} not estimated: ${breakdown}.` : `${count} ${noun} not estimated.`
}
