/**
 * Pure "what would clearing/deleting this floor lose" helpers - the single
 * source for the delete-floor confirm (`floor-active-tab-controls.tsx`) AND
 * the replace-image confirm (`use-floor-plan-image-loader.ts`), which both
 * warn about exactly the same set of fields `setImage`/`deleteFloor` discard.
 * No React/Konva/`src/catalog` imports (enforced by `no-react-konva-imports.test.ts`).
 */
import type { Floor } from './floor-types'

/** Whether a floor holds anything worth confirming before it is cleared: its own plan image/scale, or any placed item kind. */
export function floorHasPlacedContent(floor: Floor): boolean {
  return (
    floor.image !== null ||
    floor.scale !== null ||
    floor.cameras.length > 0 ||
    floor.walls.length > 0 ||
    floor.sensors.length > 0 ||
    floor.hubs.length > 0 ||
    floor.cables.length > 0 ||
    floor.fireAlarmDevices.length > 0
  )
}

/**
 * Names what clearing/deleting `floor` would lose, as a comma-separated
 * list ("its plan image, its scale calibration, 2 cameras, 1 wall") - empty
 * string if `floorHasPlacedContent(floor)` is false.
 */
export function describeFloorContent(floor: Floor): string {
  const parts: string[] = []
  if (floor.image) parts.push('its plan image')
  if (floor.scale) parts.push('its scale calibration')
  if (floor.cameras.length) parts.push(`${floor.cameras.length} camera${floor.cameras.length === 1 ? '' : 's'}`)
  if (floor.sensors.length) parts.push(`${floor.sensors.length} sensor${floor.sensors.length === 1 ? '' : 's'}`)
  if (floor.fireAlarmDevices.length) {
    parts.push(`${floor.fireAlarmDevices.length} fire-alarm device${floor.fireAlarmDevices.length === 1 ? '' : 's'}`)
  }
  if (floor.hubs.length) parts.push(`${floor.hubs.length} hub${floor.hubs.length === 1 ? '' : 's'}`)
  if (floor.cables.length) parts.push(`${floor.cables.length} cable${floor.cables.length === 1 ? '' : 's'}`)
  if (floor.walls.length) parts.push(`${floor.walls.length} wall${floor.walls.length === 1 ? '' : 's'}`)
  return parts.join(', ')
}
