import type { FailedFloorOutcome, FloorExportOutcome, SkippedFloorOutcome } from '../png/export-all-floor-plans-png'

const SKIP_REASON_TEXT = { 'no-image': 'no plan image', 'no-scale': 'no scale set' } as const

/** "F{n} {name}" - the same floor-position naming every "Export all floors" outcome list uses. */
function nameFloor(floor: FloorExportOutcome): string {
  return `F${floor.position} ${floor.name}`
}

/**
 * M2 review fix: the ONE final notification text after "Export all floors",
 * listing what was exported, what was skipped (and why), and what failed
 * (and why) - never silent on full success, never just the skip list.
 * Empty string when there is nothing to say at all (defensive - every real
 * project has at least one floor, so at least one list is always non-empty).
 */
export function describeExportAllFloorsOutcome(
  exported: readonly FloorExportOutcome[],
  skipped: readonly SkippedFloorOutcome[],
  failed: readonly FailedFloorOutcome[],
): string {
  const parts: string[] = []
  if (exported.length > 0) parts.push(`Exported: ${exported.map(nameFloor).join(', ')}.`)
  if (skipped.length > 0) parts.push(`Skipped: ${skipped.map((floor) => `${nameFloor(floor)} (${SKIP_REASON_TEXT[floor.reason]})`).join(', ')}.`)
  if (failed.length > 0) parts.push(`Failed: ${failed.map((floor) => `${nameFloor(floor)} (${floor.message})`).join(', ')}.`)
  return parts.join(' ')
}
