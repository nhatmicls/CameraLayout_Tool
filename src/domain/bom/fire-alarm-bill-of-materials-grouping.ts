import type { BomRow } from './bill-of-materials-grouping'
import type { CompatibilityWarning } from '../fire-alarm/fire-alarm-compatibility-checker'
import { FIRE_ALARM_KIND_DISPLAY_ORDER, FIRE_ALARM_KIND_LABELS, type FireAlarmKind, type FireAlarmModelSpec, type PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'

/** `Not listed for a placed panel/hub: F3, F7` - only the labels of this row's own devices that are actually warned. */
function notListedNote(labels: readonly string[]): string {
  return `Not listed for a placed panel/hub: ${labels.join(', ')}`
}

const NO_CONTROLLER_PLACED_NOTE = 'No panel/hub placed'

interface FireAlarmBomGroup {
  kind: FireAlarmKind
  model: FireAlarmModelSpec
  deviceNumbers: number[]
  /** `F{n}` labels of this group's own devices that are individually `not-listed-for-placed-controllers`. */
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
 * - Labels (`F1`, `F2`, ...) come from the device's position in `devices`,
 *   1-based, independent of camera/sensor numbering. Unknown `modelId`s are
 *   skipped, same as the other two families.
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

    const deviceNumber = index + 1
    const label = `F${deviceNumber}`
    const key = `${model.kind}\u0000${model.brand}\u0000${model.model}`
    const group = groups.get(key) ?? { kind: model.kind, model, deviceNumbers: [], warnedLabels: [], hasNoControllerWarning: false }
    group.deviceNumbers.push(deviceNumber)
    if (notListedDeviceIds.has(device.id)) group.warnedLabels.push(label)
    if (noControllerDeviceIds.has(device.id)) group.hasNoControllerWarning = true
    groups.set(key, group)
  })

  const sortedGroups = Array.from(groups.values()).sort((a, b) => {
    const kindOrder = FIRE_ALARM_KIND_DISPLAY_ORDER.indexOf(a.kind) - FIRE_ALARM_KIND_DISPLAY_ORDER.indexOf(b.kind)
    if (kindOrder !== 0) return kindOrder
    return a.model.brand.localeCompare(b.model.brand) || a.model.model.localeCompare(b.model.model)
  })

  return sortedGroups.map(({ kind, model, deviceNumbers, warnedLabels, hasNoControllerWarning }) => {
    const unitPriceVnd = model.priceVn?.amountVnd ?? null
    const notes = hasNoControllerWarning ? NO_CONTROLLER_PLACED_NOTE : warnedLabels.length > 0 ? notListedNote(warnedLabels) : ''
    return {
      type: FIRE_ALARM_KIND_LABELS[kind],
      brand: model.brand,
      model: model.model,
      formFactor: '',
      resolution: '',
      lens: '',
      quantity: deviceNumbers.length,
      unit: 'pcs',
      labels: deviceNumbers.map((n) => `F${n}`).join(', '),
      unitPriceVnd,
      lineTotalVnd: unitPriceVnd === null ? null : unitPriceVnd * deviceNumbers.length,
      notes,
    }
  })
}
