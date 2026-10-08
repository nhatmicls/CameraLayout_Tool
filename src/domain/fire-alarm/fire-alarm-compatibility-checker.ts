/**
 * Builds a reverse (device -> controllers) compatibility index from the
 * catalog's per-controller `compatibleDevices` lists, and checks a set of
 * placed devices against it. "Not listed" is not "proven incompatible" -
 * the collected sources often cover only one controller's manual, and a
 * silent product page does not mean a device is forbidden; warning text
 * must say "not listed", never "incompatible".
 *
 * Devices are never assigned to a specific controller, so capacity cannot
 * be checked honestly once more than one controller is placed - no capacity
 * warnings here (YAGNI, `capacityAsPrinted` is display-only).
 */
import type { FireAlarmModelSpec, PlacedFireAlarmDevice } from './fire-alarm-device-types'
import { isFireAlarmControllerKind } from './fire-alarm-device-types'

type FireAlarmControllerSpec = Extract<FireAlarmModelSpec, { kind: 'control-panel' | 'wireless-hub' }>

/** Narrows the whole union (not just `spec.kind`) so `spec.compatibleDevices` is visible afterwards - `isFireAlarmControllerKind` only narrows its own `kind` argument, not the object it came from. */
function isControllerSpec(spec: FireAlarmModelSpec): spec is FireAlarmControllerSpec {
  return isFireAlarmControllerKind(spec.kind)
}

/** One controller a device model is listed as compatible with. Reverse of the catalog's forward `compatibleDevices` entry. */
export interface CompatibilityLink {
  controllerModelId: string
  sourceUrl: string
  sourceRetrieved: string
  note?: string
}

export interface CompatibilityIndex {
  controllersByDeviceModelId: ReadonlyMap<string, readonly CompatibilityLink[]>
}

/**
 * Inverts every controller spec's `compatibleDevices` list into a
 * device-model -> controllers map. Symmetric by construction: there is one
 * index, built once from the forward (controller -> device) catalog data,
 * read in the reverse direction here.
 */
export function buildFireAlarmCompatibilityIndex(specs: readonly FireAlarmModelSpec[]): CompatibilityIndex {
  const map = new Map<string, CompatibilityLink[]>()
  for (const spec of specs) {
    if (!isControllerSpec(spec)) continue
    for (const entry of spec.compatibleDevices) {
      const link: CompatibilityLink = {
        controllerModelId: spec.id,
        sourceUrl: entry.sourceUrl,
        sourceRetrieved: entry.sourceRetrieved,
        note: entry.note,
      }
      const existing = map.get(entry.modelId)
      if (existing) existing.push(link)
      else map.set(entry.modelId, [link])
    }
  }
  return { controllersByDeviceModelId: map }
}

export type CompatibilityWarning =
  | { code: 'not-listed-for-placed-controllers'; deviceId: string; modelId: string }
  | { code: 'no-controller-placed'; deviceIds: string[] }

/**
 * Rules, in order:
 * 1. `worksStandalone` devices are never warned.
 * 2. Controllers are never warned.
 * 3. An unknown `modelId` (no spec) is skipped, same as the BOM.
 * 4. No controller placed and >= 1 non-standalone peripheral placed -> ONE
 *    aggregated `no-controller-placed` warning listing every such device.
 * 5. >= 1 controller placed: a peripheral not listed for ANY placed
 *    controller model -> `not-listed-for-placed-controllers`. Listed for at
 *    least one placed controller is enough to be OK.
 */
export function checkFireAlarmCompatibility(
  devices: readonly PlacedFireAlarmDevice[],
  specById: Record<string, FireAlarmModelSpec>,
  index: CompatibilityIndex,
): CompatibilityWarning[] {
  const placedControllerModelIds = new Set<string>()
  for (const device of devices) {
    const spec = specById[device.modelId]
    if (spec !== undefined && isFireAlarmControllerKind(spec.kind)) placedControllerModelIds.add(spec.id)
  }

  const warnings: CompatibilityWarning[] = []
  const noControllerDeviceIds: string[] = []

  for (const device of devices) {
    const spec = specById[device.modelId]
    if (spec === undefined) continue
    if (isFireAlarmControllerKind(spec.kind)) continue
    if (spec.worksStandalone) continue

    if (placedControllerModelIds.size === 0) {
      noControllerDeviceIds.push(device.id)
      continue
    }

    const links = index.controllersByDeviceModelId.get(device.modelId) ?? []
    const listedForAPlacedController = links.some((link) => placedControllerModelIds.has(link.controllerModelId))
    if (!listedForAPlacedController) {
      warnings.push({ code: 'not-listed-for-placed-controllers', deviceId: device.id, modelId: device.modelId })
    }
  }

  if (noControllerDeviceIds.length > 0) {
    warnings.push({ code: 'no-controller-placed', deviceIds: noControllerDeviceIds })
  }

  return warnings
}

/**
 * Keeps only the parts of `warnings` that name a device in `deviceIds` - the
 * ONE shared filter (C1/H3 review fix, phase 7): `checkFireAlarmCompatibility`
 * is now run once over the WHOLE project, so a single floor's PNG strip or
 * the BOM panel's per-floor view must filter the result down to the devices
 * actually in view before labelling them, or a line could name a device
 * that lives on no floor currently shown. A `no-controller-placed` warning
 * keeps only its own listed device ids (dropped entirely if none remain);
 * a `not-listed-for-placed-controllers` warning is kept only if its one
 * device is in the set.
 */
export function filterCompatibilityWarningsToDeviceIds(
  warnings: readonly CompatibilityWarning[],
  deviceIds: ReadonlySet<string>,
): CompatibilityWarning[] {
  return warnings.flatMap((warning): CompatibilityWarning[] => {
    if (warning.code === 'not-listed-for-placed-controllers') return deviceIds.has(warning.deviceId) ? [warning] : []
    const filteredIds = warning.deviceIds.filter((id) => deviceIds.has(id))
    return filteredIds.length > 0 ? [{ ...warning, deviceIds: filteredIds }] : []
  })
}
