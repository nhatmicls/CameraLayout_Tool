import { buildFloorItemLabels } from '../floor/floor-item-label-allocator'
import { floorPositionPrefix } from '../floor/floor-label-prefix'
import type { Floor } from '../floor/floor-types'
import type { FireAlarmKind } from './fire-alarm-device-types'

/**
 * Resolves a fire-alarm device id to the SAME label text its BOM row uses
 * (H3 review fix - "one label function", shared by the BOM panel's
 * compatibility-warnings block so a warning line's label can never show a
 * floor position/number that exists on no floor). Always floor-prefixed
 * ("F2_S3" - owner decision 2026-10-09, phase 6: every BOM-context label
 * carries its floor, one-floor project and floor-scoped view too), searched
 * only on `floorId`'s floor when given (a single-floor BOM view), matching
 * `buildCombinedBomRows(project, {floorId})`'s own rows; the project order
 * otherwise (the "All floors" merged view), matching that view's merged row
 * labels. `null` when the device is not on any floor in scope (deleted, or -
 * with `floorId` given - placed on a different floor). No `shaftIds` to
 * pass: a shaft marker never shares this floor's fire-alarm/sensor/hub
 * numbering (it bypasses the shared counter entirely), so omitting it
 * cannot shift this function's own result.
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
    const prefix = floorPositionPrefix(floors.indexOf(floor))
    return `${prefix}${buildFloorItemLabels(floor, { fireAlarmModelById: modelById }).fireAlarmDevices[index]}`
  }
  return null
}
