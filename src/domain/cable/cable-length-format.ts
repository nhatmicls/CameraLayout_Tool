import type { MetersInterval } from './cable-length-estimate-calculator'

/** Every cable length string shown in a panel or drawn in the PNG comes from here. */

/** `Math.ceil` that ignores float dust, so 18.000000001 stays 18. Lengths are never negative (the `max` also turns -0 into 0). */
export function ceilMeters(m: number): number {
  return Math.max(0, Math.ceil(m - 1e-9))
}

/** "17.8 m" (1 decimal). */
export function formatMeters(m: number): string {
  return `${m.toFixed(1)} m`
}

/** "17.8 m (17.7-18.0 m)"; no range when the interval is undefined. */
export function formatMetersInterval(interval: MetersInterval): string {
  const nominal = formatMeters(interval.nominal)
  if (interval.min === null || interval.max === null) return nominal
  return `${nominal} (${interval.min.toFixed(1)}-${formatMeters(interval.max)})`
}

/**
 * The PNG's provisional-estimate note, in whole metres (nominal rounded up,
 * min down, max up): "Cable lengths are provisional estimates: 44 m (43-45 m) incl. 15% spare".
 * Displayed term "spare" (owner decision 2026-10-09) - `wastePercent` is still the field's
 * stored name, unchanged by this phase.
 */
export function formatCableEstimateNote(grandPurchase: MetersInterval, wastePercent: number): string {
  const range =
    grandPurchase.min === null || grandPurchase.max === null
      ? ''
      : ` (${Math.floor(grandPurchase.min + 1e-9)}-${ceilMeters(grandPurchase.max)} m)`
  return `Cable lengths are provisional estimates: ${ceilMeters(grandPurchase.nominal)} m${range} incl. ${wastePercent}% spare`
}
