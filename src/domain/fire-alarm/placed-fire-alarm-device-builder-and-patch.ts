/**
 * Builds a freshly dropped `PlacedFireAlarmDevice` and applies a
 * position-only patch to an existing one. `PlacedFireAlarmDevice` has no
 * kind-specific fields (see `fire-alarm-device-types.ts`'s "Key Insights"),
 * so both functions are far smaller than their sensor counterparts
 * (`sensor-default-placement-builder.ts`, `placed-sensor-patch.ts`) - there
 * is nothing but `x`/`y` to default or patch.
 */
import type { PlacedFireAlarmDevice } from './fire-alarm-device-types'

export interface BuildPlacedFireAlarmDeviceAtDropInput {
  id: string
  modelId: string
  /** Drop point, image px. */
  x: number
  y: number
}

export function buildPlacedFireAlarmDeviceAtDrop(input: BuildPlacedFireAlarmDeviceAtDropInput): PlacedFireAlarmDevice {
  return { id: input.id, modelId: input.modelId, x: input.x, y: input.y }
}

export interface PlacedFireAlarmDevicePatch {
  x?: number
  y?: number
}

/**
 * Returns a new device with `patch`'s keys applied, ignoring any key whose
 * value already equals the device's current one. Returns `device` itself
 * (same reference) when nothing in `patch` actually changes anything - the
 * same no-op-returns-same-ref contract `applyPlacedSensorPatch` and
 * `updateWall` rely on for undo-history reference equality.
 */
export function applyPlacedFireAlarmDevicePatch(device: PlacedFireAlarmDevice, patch: PlacedFireAlarmDevicePatch): PlacedFireAlarmDevice {
  const fields: Partial<Pick<PlacedFireAlarmDevice, 'x' | 'y'>> = {}
  if (patch.x !== undefined && patch.x !== device.x) fields.x = patch.x
  if (patch.y !== undefined && patch.y !== device.y) fields.y = patch.y
  if (Object.keys(fields).length === 0) return device
  return { ...device, ...fields }
}
