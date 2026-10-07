/**
 * Picks which of the fire-detector coverage readout's six cases applies, and
 * the figures needed to render the "circle drawn" case - pure logic kept out
 * of the React component (`fire-detector-coverage-readout.tsx`) so it is
 * unit-testable without rendering. Still re-derives the TCVN row lookup
 * directly for the five non-circle cases (`resolveFireDetectorCoverage`
 * collapses "no ceiling height" / "no table for this kind" / "above the
 * table" into one `null`, losing exactly the distinction this readout needs
 * to word its reason) - but the "circle" case's own figures (radius, area,
 * spacing, wall distance) come from `resolveFireDetectorCoverage` itself,
 * not a second, hand-rolled copy of the same table math, so there is one
 * source of truth for those four numbers.
 *
 * Case order mirrors the phase-07 spec exactly:
 * (a) not a detector -> no readout
 * (b) datasheet mode -> "the datasheet prints no protection area"
 * (c) TCVN mode, no ceiling height -> "enter ceiling height"
 * (e) CO detector -> "TCVN 5738 has no table for CO detectors" (no table at
 *     any height, so checked before the height-band lookup would matter)
 * (d) height above the table's tallest band -> "outside the standard's
 *     table - no circle"
 * no scale -> "needs a scale" (only reachable once a circle would otherwise
 *     be drawn - cases (b)-(e) are textual reasons independent of scale)
 * (f) circle drawn -> edition/clause/table, ceiling height, area, the
 *     equal-area radius, printed spacing and wall distance
 */
import {
  FIRE_ALARM_KIND_LABELS,
  isFireDetectorKind,
  type FireAlarmModelSpec,
  type FireAlarmSettings,
} from '../../domain/fire-alarm/fire-alarm-device-types'
import { resolveFireDetectorCoverage } from '../../domain/fire-alarm/fire-detector-coverage-resolver'
import { lookupTcvn5738Row, TCVN_5738_CITATIONS, TCVN_5738_EDITION } from '../../domain/fire-alarm/tcvn-5738-detector-protection-table'

export type FireDetectorCoverageReadout =
  | { case: 'not-detector' }
  | { case: 'datasheet-mode' }
  | { case: 'needs-ceiling-height' }
  | { case: 'co-no-table' }
  | { case: 'outside-table'; kindLabel: string }
  | { case: 'needs-scale' }
  | {
      case: 'circle'
      edition: string
      clause: string
      table: string
      ceilingHeightM: number
      areaM2: number
      radiusM: number
      spacingM: number
      wallDistanceM: number
    }

export function resolveFireDetectorCoverageReadout(
  spec: FireAlarmModelSpec,
  settings: FireAlarmSettings,
  hasScale: boolean,
): FireDetectorCoverageReadout {
  const { kind } = spec
  if (!isFireDetectorKind(kind)) return { case: 'not-detector' }
  if (settings.coverageMode === 'datasheet') return { case: 'datasheet-mode' }
  // No table for this detector type (CO): say so before asking for a ceiling height that would not help.
  if (TCVN_5738_CITATIONS[kind] === undefined) return { case: 'co-no-table' }
  if (settings.ceilingHeightM === null) return { case: 'needs-ceiling-height' }

  const row = lookupTcvn5738Row(kind, settings.ceilingHeightM)
  if (row === 'no-table') return { case: 'co-no-table' }
  if (row === 'above-table') return { case: 'outside-table', kindLabel: FIRE_ALARM_KIND_LABELS[kind] }
  if (!hasScale) return { case: 'needs-scale' }

  const citation = TCVN_5738_CITATIONS[kind]!
  // row is neither 'no-table' nor 'above-table' and coverageMode is 'tcvn-5738' with a set
  // ceiling height, so resolveFireDetectorCoverage resolves the same row and never returns null.
  const coverage = resolveFireDetectorCoverage(spec, settings)!
  return {
    case: 'circle',
    edition: TCVN_5738_EDITION,
    clause: citation.clause,
    table: citation.table,
    ceilingHeightM: settings.ceilingHeightM,
    areaM2: coverage.areaM2,
    radiusM: coverage.radiusM,
    spacingM: coverage.spacingM,
    wallDistanceM: coverage.wallDistanceM,
  }
}
