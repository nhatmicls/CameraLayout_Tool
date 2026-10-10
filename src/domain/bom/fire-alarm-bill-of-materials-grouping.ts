import type { BomRow } from './bill-of-materials-grouping'
import type { CompatibilityWarning } from '../fire-alarm/fire-alarm-compatibility-checker'
import { FIRE_ALARM_KIND_DISPLAY_ORDER, FIRE_ALARM_KIND_LABELS, type FireAlarmKind, type FireAlarmModelSpec, type PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'

/** Prefix of a "not listed" note - exported so `merge-bom-rows-across-floors.ts` can floor-prefix the device labels inside it and combine two floors' lists without re-parsing free text. */
export const NOT_LISTED_NOTE_PREFIX = 'Not listed for a placed panel/hub: '

/** `Not listed for a placed panel/hub: F3, F7` - only the labels of this row's own devices that are actually warned. */
function notListedNote(labels: readonly string[]): string {
  return `${NOT_LISTED_NOTE_PREFIX}${labels.join(', ')}`
}

export const NO_CONTROLLER_PLACED_NOTE = 'No panel/hub placed'

/**
 * Floor-prefixes the device labels inside a "not listed" note (`F3` ->
 * `F2_F3`); every other note shape (`''`, `NO_CONTROLLER_PLACED_NOTE`, or
 * already-undefined) carries no per-device label, so it is returned
 * unchanged. `prefix` is never empty in practice (`floorPositionPrefix`
 * always returns `'F{n}_'`, even for a one-floor project) - the `!prefix`
 * guard only keeps this safe for a caller that ever passes one.
 */
export function prefixFireAlarmNoteLabels(notes: string, prefix: string): string {
  if (!prefix || !notes.startsWith(NOT_LISTED_NOTE_PREFIX)) return notes
  const labels = notes
    .slice(NOT_LISTED_NOTE_PREFIX.length)
    .split(', ')
    .map((label) => `${prefix}${label}`)
  return `${NOT_LISTED_NOTE_PREFIX}${labels.join(', ')}`
}

/**
 * Combines two (already floor-prefixed) fire-alarm notes for the same
 * merged BOM row. Compatibility is per-model (`fire-alarm-compatibility-checker.ts`'s
 * own comment: every device sharing a model gets the same verdict), so two
 * floors' rows for one model are either both `NO_CONTROLLER_PLACED_NOTE`
 * (kept as-is - nothing to combine), both a "not listed" list (their device
 * labels combined into one list), or one/both empty (the non-empty one
 * wins). The `a}; ${b}` fallback only guards a theoretical mismatch; the
 * invariant above means it should never actually be reached.
 */
export function combineFireAlarmNotes(a: string | undefined, b: string | undefined): string | undefined {
  if (a === undefined || b === undefined) return a ?? b
  if (a === '') return b
  if (b === '') return a
  if (a === b) return a
  if (a.startsWith(NOT_LISTED_NOTE_PREFIX) && b.startsWith(NOT_LISTED_NOTE_PREFIX)) {
    const labels = [...a.slice(NOT_LISTED_NOTE_PREFIX.length).split(', '), ...b.slice(NOT_LISTED_NOTE_PREFIX.length).split(', ')]
    return `${NOT_LISTED_NOTE_PREFIX}${labels.join(', ')}`
  }
  return `${a}; ${b}`
}

interface FireAlarmBomGroup {
  kind: FireAlarmKind
  model: FireAlarmModelSpec
  /** Designator labels (`S1`, `KP2`...) of this group's own devices, in `devices[]` order. */
  labels: string[]
  /** Labels of this group's own devices that are individually `not-listed-for-placed-controllers`. */
  warnedLabels: string[]
  /** True when at least one of this group's own devices is in a `no-controller-placed` warning. */
  hasNoControllerWarning: boolean
}

/**
 * Groups placed fire-alarm devices into BOM rows - the fire-alarm twin of
 * `groupCamerasIntoBom` / `groupSensorsIntoBom`. Deviations (CLAUDE.md /
 * phase 8 decisions):
 * - `formFactor`, `resolution`, `lens` are always empty - no fire-alarm
 *   record carries any of those fields.
 * - Grouping key is (kind, brand, model) - no lens variant exists here.
 * - Sorted by `FIRE_ALARM_KIND_DISPLAY_ORDER` (not alphabetically by label,
 *   unlike the sensor grouping), then brand, then model.
 * - `labels` is index-aligned with `devices` (from the ONE shared allocator,
 *   `floor-item-label-allocator.ts`'s `buildFloorItemLabels` - this function
 *   no longer numbers anything itself). Unknown `modelId`s are skipped, same
 *   as the other two families.
 * - `notes` carries a `checkFireAlarmCompatibility` warning for this row's
 *   own devices: "Not listed for a placed panel/hub: F3, F7" (only the
 *   warned labels of this row) when at least one of them is individually
 *   not listed, or "No panel/hub placed" when at least one is in the
 *   aggregated no-controller-placed case; empty otherwise. Compatibility is
 *   per-model (every device sharing a `modelId` gets the same checker
 *   verdict), so in practice every device in one row is either all warned
 *   or none are - this still only reports the labels that are actually
 *   warned, in case a future catalog ever breaks that uniformity.
 */
export function groupFireAlarmDevicesIntoBom(
  devices: readonly PlacedFireAlarmDevice[],
  modelById: Record<string, FireAlarmModelSpec>,
  labels: readonly string[],
  warnings: readonly CompatibilityWarning[] = [],
): BomRow[] {
  const notListedDeviceIds = new Set(
    warnings.filter((w) => w.code === 'not-listed-for-placed-controllers').map((w) => w.deviceId),
  )
  const noControllerDeviceIds = new Set(warnings.flatMap((w) => (w.code === 'no-controller-placed' ? w.deviceIds : [])))

  const groups = new Map<string, FireAlarmBomGroup>()

  devices.forEach((device, index) => {
    const model = modelById[device.modelId]
    if (!model) return

    const label = labels[index]
    const key = `${model.kind}\u0000${model.brand}\u0000${model.model}`
    const group = groups.get(key) ?? { kind: model.kind, model, labels: [], warnedLabels: [], hasNoControllerWarning: false }
    group.labels.push(label)
    if (notListedDeviceIds.has(device.id)) group.warnedLabels.push(label)
    if (noControllerDeviceIds.has(device.id)) group.hasNoControllerWarning = true
    groups.set(key, group)
  })

  const rows: BomRow[] = Array.from(groups.values()).map(({ kind, model, labels, warnedLabels, hasNoControllerWarning }) => {
    const unitPriceVnd = model.priceVn?.amountVnd ?? null
    const notes = hasNoControllerWarning ? NO_CONTROLLER_PLACED_NOTE : warnedLabels.length > 0 ? notListedNote(warnedLabels) : ''
    return {
      type: FIRE_ALARM_KIND_LABELS[kind],
      brand: model.brand,
      model: model.model,
      formFactor: '',
      resolution: '',
      lens: '',
      quantity: labels.length,
      unit: 'pcs',
      labels: labels.join(', '),
      unitPriceVnd,
      lineTotalVnd: unitPriceVnd === null ? null : unitPriceVnd * labels.length,
      notes,
    }
  })

  rows.sort(compareFireAlarmBomRows)
  return rows
}

/** `type` label order from `FIRE_ALARM_KIND_DISPLAY_ORDER` (control panels before detectors, etc.) - built once, module load time. */
const FIRE_ALARM_TYPE_LABEL_ORDER = FIRE_ALARM_KIND_DISPLAY_ORDER.map((kind) => FIRE_ALARM_KIND_LABELS[kind])

/** Fire-alarm row order: kind (`FIRE_ALARM_KIND_DISPLAY_ORDER`, via its row-facing `type` label), then brand, then model - exported so `merge-bom-rows-across-floors.ts` re-sorts a cross-floor merge with the SAME comparator instead of re-implementing it. */
export function compareFireAlarmBomRows(a: BomRow, b: BomRow): number {
  const kindOrder = FIRE_ALARM_TYPE_LABEL_ORDER.indexOf(a.type) - FIRE_ALARM_TYPE_LABEL_ORDER.indexOf(b.type)
  if (kindOrder !== 0) return kindOrder
  return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model)
}
