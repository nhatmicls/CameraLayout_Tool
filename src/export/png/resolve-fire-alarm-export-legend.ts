/**
 * Pure logic behind the PNG strip's fire-alarm legend line and compatibility-
 * warning line (kept out of `export-plan-png.ts`/`draw-export-fire-alarm-legend-lines.ts`
 * so the figures are unit-testable without a canvas), mirroring
 * `resolveSensorKindsPresent` in `export-plan-png.ts`.
 */
import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import {
  FIRE_ALARM_KIND_DISPLAY_ORDER,
  type FireAlarmKind,
  type FireAlarmModelSpec,
  type FireAlarmSettings,
  type PlacedFireAlarmDevice,
} from '../../domain/fire-alarm/fire-alarm-device-types'
import { resolveFireDetectorCoverage } from '../../domain/fire-alarm/fire-detector-coverage-resolver'
import { TCVN_5738_EDITION } from '../../domain/fire-alarm/tcvn-5738-detector-protection-table'
import type { FireAlarmLegend } from './draw-export-fire-alarm-legend-lines'

/**
 * `null` when no placed device has a known catalog model (same "no line for
 * an empty/unknown-only plan" rule as `resolveSensorKindsPresent`). Otherwise
 * the kind counts, in `FIRE_ALARM_KIND_DISPLAY_ORDER`, plus a coverage-basis
 * note shown ONLY when at least one device's circle is actually drawn
 * (`scaleIsSet` true, `tcvn-5738` mode, a ceiling height inside the
 * standard's table) - matching `FireDetectorCoverageShapes`' own gating, so
 * the legend never claims a basis the export did not draw.
 */
export function resolveFireAlarmLegend(
  devices: readonly PlacedFireAlarmDevice[],
  modelById: Record<string, FireAlarmModelSpec>,
  settings: FireAlarmSettings,
  scaleIsSet: boolean,
): FireAlarmLegend | null {
  const counts = new Map<FireAlarmKind, number>()
  let hasDrawnCircle = false

  for (const device of devices) {
    const model = modelById[device.modelId]
    if (!model) continue
    counts.set(model.kind, (counts.get(model.kind) ?? 0) + 1)
    if (scaleIsSet && resolveFireDetectorCoverage(model, settings) !== null) hasDrawnCircle = true
  }

  if (counts.size === 0) return null

  const kindCounts = FIRE_ALARM_KIND_DISPLAY_ORDER.filter((kind) => counts.has(kind)).map((kind) => ({
    kind,
    count: counts.get(kind)!,
  }))

  const coverageBasisText =
    hasDrawnCircle && settings.ceilingHeightM !== null
      ? `coverage: ${TCVN_5738_EDITION} at h = ${settings.ceilingHeightM} m, equal-area circle, approximation`
      : null

  return { kindCounts, coverageBasisText }
}

const MAX_LABELS_SHOWN = 2

/** `F{n}` label from a device's 1-based position in `devices`, or the id itself when it is no longer placed (defensive only). */
function labelFor(deviceId: string, devices: readonly PlacedFireAlarmDevice[]): string {
  const index = devices.findIndex((d) => d.id === deviceId)
  return index >= 0 ? `F${index + 1}` : deviceId
}

/** "F3, F7 +2 more" for > `MAX_LABELS_SHOWN` labels, else the plain joined list. */
function formatLabelList(labels: readonly string[]): string {
  if (labels.length <= MAX_LABELS_SHOWN) return labels.join(', ')
  return `${labels.slice(0, MAX_LABELS_SHOWN).join(', ')} +${labels.length - MAX_LABELS_SHOWN} more`
}

/**
 * "Compatibility: N device(s) not listed for a placed panel/hub: F3, F7 +2
 * more" or "No panel/hub placed for: F1, F2" - null when there are no
 * warnings. The two `CompatibilityWarning` codes are mutually exclusive at
 * the plan level (`checkFireAlarmCompatibility`: a `no-controller-placed`
 * warning only exists when zero controllers are placed, in which case no
 * `not-listed-for-placed-controllers` warning is ever produced), so at most
 * one of the two branches below ever applies.
 */
export function resolveCompatibilityWarningText(
  devices: readonly PlacedFireAlarmDevice[],
  warnings: readonly CompatibilityWarning[],
): string | null {
  if (warnings.length === 0) return null

  const noControllerWarning = warnings.find((w) => w.code === 'no-controller-placed')
  if (noControllerWarning) {
    const labels = noControllerWarning.deviceIds.map((id) => labelFor(id, devices))
    return `No panel/hub placed for: ${formatLabelList(labels)}`
  }

  const notListed = warnings.filter((w) => w.code === 'not-listed-for-placed-controllers')
  const labels = notListed.map((w) => labelFor(w.deviceId, devices))
  return `Compatibility: ${notListed.length} device(s) not listed for a placed panel/hub: ${formatLabelList(labels)}`
}
