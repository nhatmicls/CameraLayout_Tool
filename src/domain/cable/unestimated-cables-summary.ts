import type { CableEstimateWarning } from './cable-layout-estimate'
import type { HubBeyondLength } from './cross-floor-hub-beyond-length-resolver'

/**
 * The one place "a cable was excluded from the estimate" gets worded into a
 * summary line - the BOM panel, the CSV export's notification and the PNG
 * legend all call this, so an unestimated cross-floor cable can never just
 * silently vanish from one surface while still being counted (or not) on
 * another.
 *
 * H2 fix (phase 6 review): keyed by `UnavailableReason` - EVERY reason
 * `HubBeyondLength`'s `source: 'unavailable'` member can carry, not a
 * `Partial` over the much wider `CableEstimateWarning['code']` union (which
 * also has non-exclusion codes like `cable-over-limit` that must NEVER be
 * counted here). Because `unavailableWarning` (`cable-layout-estimate.ts`)
 * gives every unestimated cable's warning a `code` equal to its own
 * `beyond.reason`, and every `unestimatedCableCount` increment comes with
 * exactly one such warning, a `Record` (not `Partial`) that TypeScript
 * forces to stay exhaustive over `UnavailableReason` is what makes "the
 * breakdown always sums to the count" a compile-time guarantee instead of a
 * promise a future new reason could silently break.
 */
type UnavailableReason = Extract<HubBeyondLength, { source: 'unavailable' }>['reason']

const REASON_LABELS: Record<UnavailableReason, string> = {
  'linked-floor-scale-not-set': 'a linked floor has no scale set',
  'link-cycle': 'its cross-floor route forms a cycle',
}

function isUnavailableReasonCode(code: CableEstimateWarning['code']): code is UnavailableReason {
  return code in REASON_LABELS
}

/**
 * "N cable(s) not estimated: <reason> (<n>); <reason> (<n>)." - counts are
 * broken down by reason for every `warnings` entry carrying a `cableId` and
 * one of `REASON_LABELS`' codes; falls back to a plain count if none match
 * (should not happen - see the exhaustiveness note above). `null` when
 * `count` is 0 (nothing to say).
 */
export function describeUnestimatedCables(count: number, warnings: readonly CableEstimateWarning[]): string | null {
  if (count <= 0) return null
  const countByReason = new Map<string, number>()
  for (const warning of warnings) {
    if (warning.cableId === undefined) continue
    if (!isUnavailableReasonCode(warning.code)) continue
    const label = REASON_LABELS[warning.code]
    countByReason.set(label, (countByReason.get(label) ?? 0) + 1)
  }
  const noun = count === 1 ? 'cable' : 'cables'
  const breakdown = Array.from(countByReason, ([label, n]) => `${label} (${n})`).join('; ')
  return breakdown ? `${count} ${noun} not estimated: ${breakdown}.` : `${count} ${noun} not estimated.`
}
