/**
 * Resolves a placed fire detector's drawable coverage circle against the
 * project's `FireAlarmSettings`. Unlike `resolveSensorAreaCoverage`, this
 * takes project-level input (the coverage mode + ceiling height), not just
 * the placed device and its catalog spec - there is no per-device radius to
 * read.
 *
 * Phase 1 finding (`docs/fire-alarm-catalog-sources.md` C1/C2): no shipped
 * detector datasheet prints a protection radius or area, so `datasheet`
 * mode always returns `null` here - a detector circle only ever exists in
 * `tcvn-5738` mode. `basis` therefore has a single value today; it stays a
 * union of one so a future datasheet-sourced radius is a non-breaking
 * addition, not a renamed field.
 *
 * TCVN gives an area + spacing grid, not a circle - `equalAreaCircleRadiusM`
 * draws a circle whose area equals the standard's protected area per
 * detector. That keeps total drawn area honest but under-draws a compliant
 * grid's corners slightly (the safe direction) - see the phase-3 plan file
 * for the full trade-off note. Any caller showing this circle must label it
 * as an approximation.
 */
import { isFireDetectorKind, type FireAlarmModelSpec, type FireAlarmSettings, type FireDetectorKind } from './fire-alarm-device-types'
import { lookupTcvn5738Row } from './tcvn-5738-detector-protection-table'

export interface ResolvedFireCoverage {
  radiusM: number
  /** Single value today (phase 1: no datasheet prints a radius/area) - kept as a union for a future, non-breaking addition. */
  basis: 'tcvn-5738'
  /** TCVN protected area per detector, m2. Display only - the circle is the equal-area approximation, not this area's own shape. Always set: a `null` row (no table / above table) returns `null` for the whole result, not a partial one (`resolveTcvnCoverage` below). */
  areaM2: number
  /** TCVN max spacing between detectors, metres. Display only. Always set - see `areaM2`. */
  spacingM: number
  /** TCVN max detector-to-wall distance, metres. Display only. Always set - see `areaM2`. */
  wallDistanceM: number
}

/** Radius of a circle whose area equals `areaM2` (`r = sqrt(A / pi)`). */
export function equalAreaCircleRadiusM(areaM2: number): number {
  return Math.sqrt(areaM2 / Math.PI)
}

function resolveTcvnCoverage(kind: FireDetectorKind, ceilingHeightM: number | null): ResolvedFireCoverage | null {
  if (ceilingHeightM === null) return null
  const row = lookupTcvn5738Row(kind, ceilingHeightM)
  if (row === 'above-table' || row === 'no-table') return null
  return {
    radiusM: equalAreaCircleRadiusM(row.areaM2),
    basis: 'tcvn-5738',
    areaM2: row.areaM2,
    spacingM: row.spacingM,
    wallDistanceM: row.wallDistanceM,
  }
}

/**
 * `null` for every non-detector kind. For a detector: `null` in `datasheet`
 * mode (no shipped datasheet prints a protection value); in `tcvn-5738`
 * mode, `null` when no ceiling height is set, the kind has no printed table
 * (always true for `co-detector`), or the height is above the table's last
 * band - else the equal-area circle for the matching row.
 */
export function resolveFireDetectorCoverage(spec: FireAlarmModelSpec, settings: FireAlarmSettings): ResolvedFireCoverage | null {
  if (!isFireDetectorKind(spec.kind)) return null
  if (settings.coverageMode === 'datasheet') return null
  return resolveTcvnCoverage(spec.kind, settings.ceilingHeightM)
}
