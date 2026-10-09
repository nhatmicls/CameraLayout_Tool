import { floorLabelPrefix } from '../floor/floor-label-prefix'
import type { Floor } from '../floor/floor-types'
import { buildFireAlarmDeviceLabels } from './fire-alarm-device-designator'
import type { FireAlarmKind } from './fire-alarm-device-types'

/**
 * Resolves a fire-alarm device id to the SAME label text its BOM row uses
 * (H3 review fix - "one label function", shared by the BOM panel's
 * compatibility-warnings block so a warning line's label can never show a
 * floor position/number that exists on no floor). `floorId` given (a
 * single-floor BOM view) -> bare designator ("S3", "KP1" - see
 * `buildFireAlarmDeviceLabels`), searched only on that floor, matching
 * `buildCombinedBomRows(project, {floorId})`'s own unprefixed rows.
 * `floorId` omitted (the "All floors" merged view) -> floor-prefixed
 * "F2_S3" (project order), matching that view's merged row labels. `null`
 * when the device is not on any floor in scope (deleted, or - with
 * `floorId` given - placed on a different floor).
 */
export function resolveFireAlarmDeviceLabel(
  floors: readonly Floor[],
  deviceId: string,
  modelById: Readonly<Record<string, { kind: FireAlarmKind } | undefined>>,
  floorId?: string,
): string | null {
  const floorsInScope = floorId ? floors.filter((floor) => floor.id === floorId) : floors
  for (const floor of floorsInScope) {
    const index = floor.fireAlarmDevices.findIndex((device) => device.id === deviceId)
    if (index < 0) continue
    const prefix = floorId ? '' : floorLabelPrefix(floors.indexOf(floor), floors.length)
    return `${prefix}${buildFireAlarmDeviceLabels(floor.fireAlarmDevices, modelById)[index]}`
  }
  return null
}
