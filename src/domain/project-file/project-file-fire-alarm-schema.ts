import { z } from 'zod'
import { CEILING_HEIGHT_MAX_M } from '../fire-alarm/tcvn-5738-detector-protection-table'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'

/** Mirrors `MAX_CAMERAS`/`MAX_SENSORS`/`MAX_WALLS`'s generous-but-bounded intent. */
export const MAX_FIRE_ALARM_DEVICES = 500

const FIRE_ALARM_ID_MAX_LENGTH = 100
const FIRE_ALARM_COORD_LIMIT_PX = 1_000_000
const coord = z.number().finite().gte(-FIRE_ALARM_COORD_LIMIT_PX).lte(FIRE_ALARM_COORD_LIMIT_PX)

/** On-disk shape of a placed fire-alarm device - no shape discriminator, see `PlacedFireAlarmDevice`'s own doc comment for why. */
export const placedFireAlarmDeviceSchema = z.strictObject({
  id: z.string().min(1).max(FIRE_ALARM_ID_MAX_LENGTH),
  modelId: z.string().min(1).max(FIRE_ALARM_ID_MAX_LENGTH),
  x: coord,
  y: coord,
})

type LoadedPlacedFireAlarmDevice = z.infer<typeof placedFireAlarmDeviceSchema>

/** On-disk shape of `FireAlarmSettings`. Both enum values are always accepted, even on a build whose TCVN table is empty (G3 no-go) - the resolver returns `null` (markers only) at draw time, never rejected at load time. */
export const fireAlarmSettingsSchema = z.strictObject({
  coverageMode: z.enum(['datasheet', 'tcvn-5738']),
  ceilingHeightM: z.number().finite().gt(0).lte(CEILING_HEIGHT_MAX_M).nullable(),
})

/**
 * Drops a loaded fire-alarm device, each with one warning string, when its
 * `modelId` is unknown or its `id` repeats an earlier device. Mirrors
 * `normaliseLoadedSensors`'/`normaliseLoadedWalls`' drop-with-warning shape -
 * simpler here since there is no shape/kind mismatch to check
 * (`PlacedFireAlarmDevice` has no shape field).
 */
export function normaliseLoadedFireAlarmDevices(
  devices: readonly LoadedPlacedFireAlarmDevice[],
  knownModelIds: ReadonlySet<string>,
  warnings: string[],
): PlacedFireAlarmDevice[] {
  const seenIds = new Set<string>()
  const kept: PlacedFireAlarmDevice[] = []

  for (const device of devices) {
    if (!knownModelIds.has(device.modelId)) {
      warnings.push(`Fire-alarm device "${device.id}" references unknown model "${device.modelId}"; dropped.`)
      continue
    }
    if (seenIds.has(device.id)) {
      warnings.push(`Fire-alarm device id "${device.id}" is used more than once; the repeat was dropped.`)
      continue
    }
    seenIds.add(device.id)
    kept.push(device)
  }

  return kept
}
