/**
 * User-facing strings for the fire-alarm catalog card, device properties
 * panel and coverage controls, kept in one module so wording never drifts
 * between them (phase-07 risk register: "Wording drift between card, panel
 * and README"). The README reuses these too - do not inline a copy
 * elsewhere IN THE PANELS LAYER. The BOM/CSV notes
 * (`src/domain/bom/fire-alarm-bill-of-materials-grouping.ts`) and the PNG
 * legend (`src/export/png/resolve-fire-alarm-export-legend.ts`) word the
 * same facts in their own separate strings instead of importing from here:
 * domain/export code must not depend on the panels layer (CLAUDE.md), so a
 * shared constants module would have to move out of `src/panels` to serve
 * all three - not worth it for a handful of short strings. Keep their
 * wording in substance agreement with this file by hand, not by import.
 */
import type { FireAlarmProductLine } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'

/**
 * `docs/fire-alarm-catalog-sources.md` C5: every AX device needs a panel/hub;
 * the one standalone line does not. AX PRO's note names smoke detectors
 * because the official AXPRO Series Compatibility List ticks smoke/heat/CO
 * detectors; AX Hybrid PRO's does not, because the official AX HYBRID PRO
 * list gives the catalog's smoke detector (DS-PDSMK-S-WE) no version ("—") -
 * do not add that clause back without a source.
 */
export const FIRE_ALARM_PRODUCT_LINE_NOTES: Record<FireAlarmProductLine, string> = {
  'ax-hybrid': 'Intrusion alarm system - not a certified fire alarm control panel.',
  'ax-pro': 'Intrusion alarm system that accepts smoke detectors - not a certified fire alarm control panel.',
  standalone: 'Works on its own - no panel or hub.',
}

/** C1/C2: no shipped detector datasheet prints a protection radius or area. */
export const FIRE_DETECTOR_PROTECTION_NOT_PRINTED = 'Protection area: not printed in the datasheet'

export const FIRE_COVERAGE_DATASHEET_MODE = 'No circle: the datasheet prints no protection area.'
export const FIRE_COVERAGE_NEEDS_CEILING_HEIGHT = 'Enter a ceiling height to draw a circle.'
export const FIRE_COVERAGE_CO_NO_TABLE = 'TCVN 5738 has no table for CO detectors.'
export const FIRE_COVERAGE_NEEDS_SCALE = 'Set the scale (toolbar -> "Set scale") to draw a coverage circle.'

/** `kindLabel` e.g. "Smoke detector" - the ceiling height exceeds the standard's tallest band for that kind. */
export function fireCoverageOutsideTableMessage(kindLabel: string): string {
  return `${kindLabel}: outside the standard's table - no circle.`
}

export const FIRE_COVERAGE_APPROXIMATION_NOTE =
  "standard-derived approximation: circles on a compliant grid leave gaps at the corners - a planning aid, not a compliance check"

/** Every shipped detector is an AX PRO or standalone smoke alarm - none is certified to TCVN 5738 (Validation Session 1, Q6). Shown next to every drawn circle. */
export const FIRE_COVERAGE_NOT_CERTIFIED_NOTE = 'this device is not certified to TCVN 5738'

/** Shown beside the TCVN 5738 option in the coverage-mode select. */
export const FIRE_COVERAGE_MODE_TCVN_HINT = 'standard-derived approximation, not datasheet'

export const FIRE_COMPATIBILITY_CONTROLLER_HEADING = 'Compatible devices in this catalog'
export const FIRE_COMPATIBILITY_NONE_RECORDED = 'No official compatibility data recorded'
export const FIRE_COMPATIBILITY_WORKS_STANDALONE = 'Works standalone - no compatibility check needed'
export const FIRE_COMPATIBILITY_NO_CONTROLLER_PLACED =
  'No control panel or wireless hub is placed yet - compatibility cannot be checked.'
/** "Not listed" - never "incompatible": the collected sources are not exhaustive (docs/fire-alarm-catalog-sources.md). */
export const FIRE_COMPATIBILITY_NOT_LISTED = 'Not listed as compatible with any placed control panel or wireless hub.'


export const FIRE_COMPATIBILITY_WARNINGS_HEADING = 'Compatibility warnings'

/**
 * BOM panel warnings-block line for one `not-listed-for-placed-controllers`
 * device, e.g. "F3 DS-PDSMK-S-WE is not listed for any placed panel / hub
 * (official documents as recorded - not proof of incompatibility)." Agrees
 * in substance with `FIRE_COMPATIBILITY_NOT_LISTED` (the properties-panel
 * status line) - both say "not listed", never "incompatible".
 */
export function fireAlarmBomNotListedWarningLine(label: string, modelName: string): string {
  return `${label} ${modelName} is not listed for any placed panel / hub (official documents as recorded - not proof of incompatibility).`
}

/** BOM panel warnings-block aggregated line for the `no-controller-placed` case, e.g. "No panel or hub is placed yet for: F1, F2." */
export function fireAlarmBomNoControllerPlacedLine(labels: string): string {
  return `No panel or hub is placed yet for: ${labels}.`
}
