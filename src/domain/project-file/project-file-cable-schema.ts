import { z } from 'zod'
import {
  CABLE_LENGTH_LIMIT_MAX_M,
  CABLE_PRICE_MAX_VND_PER_M,
  CABLE_SETTINGS_BOUNDS,
  CABLE_TYPE_NAME_MAX_LENGTH,
  HUB_EXTRA_LENGTH_BOUNDS,
  HUB_MOUNT_HEIGHT_BOUNDS,
  MAX_CABLE_POINTS,
  MAX_SHAFTS,
  SHAFT_NAME_MAX_LENGTH,
  createDefaultCableTypes,
  type Cable,
  type CableType,
  type Hub,
} from '../cable/cable-layout-types'
import { cableRefProblem } from '../cable/cable-reference-integrity'
import type { PlacedSensor } from '../sensor/sensor-types'
import type { PlacedCamera } from './project-types'

/**
 * On-disk shapes of the cable layout. Split out of `project-file-schema.ts`
 * to keep that file under 200 lines. `cableTypes` are project-wide (one
 * list for the whole building); `hubs`/`cables` are per floor - the
 * normaliser below is split the same way (`normaliseLoadedCableTypes` once,
 * `normaliseLoadedFloorCabling` per floor) so a dedupe warning on a repeated
 * type id is raised once, not once per floor.
 */

const CABLE_COORD_LIMIT_PX = 1_000_000
const coord = z.number().finite().gte(-CABLE_COORD_LIMIT_PX).lte(CABLE_COORD_LIMIT_PX)
const id = z.string().min(1).max(100)

function bounded(bounds: { min: number; max: number }) {
  return z.number().finite().gte(bounds.min).lte(bounds.max)
}

export const hubSchema = z.strictObject({
  id,
  kind: z.enum(['riser', 'drop']).optional(),
  x: coord,
  y: coord,
  mountHeightM: bounded(HUB_MOUNT_HEIGHT_BOUNDS),
  extraLengthM: bounded(HUB_EXTRA_LENGTH_BOUNDS).optional(),
})

const cableEndRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('camera'), id }),
  z.strictObject({ kind: z.literal('sensor'), id, end: z.enum(['tx', 'rx']).optional() }),
])

export const cableSchema = z.strictObject({
  id,
  device: cableEndRefSchema,
  hubId: id,
  typeId: id,
  points: z.array(z.strictObject({ x: coord, y: coord })).max(MAX_CABLE_POINTS),
})

export const cableTypeSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(CABLE_TYPE_NAME_MAX_LENGTH),
  lengthLimitM: z.number().finite().gt(0).lte(CABLE_LENGTH_LIMIT_MAX_M).nullable(),
  pricePerMeterVnd: z.number().int().gte(0).lte(CABLE_PRICE_MAX_VND_PER_M).nullable(),
})

export const cableSettingsSchema = z.strictObject({
  wastePercent: bounded(CABLE_SETTINGS_BOUNDS.wastePercent),
  routeHeightM: bounded(CABLE_SETTINGS_BOUNDS.routeHeightM),
  defaultDeviceHeightM: bounded(CABLE_SETTINGS_BOUNDS.defaultDeviceHeightM),
  deviceEndSlackM: bounded(CABLE_SETTINGS_BOUNDS.deviceEndSlackM),
  hubEndSlackM: bounded(CABLE_SETTINGS_BOUNDS.hubEndSlackM),
  clickErrorPx: bounded(CABLE_SETTINGS_BOUNDS.clickErrorPx),
})

/**
 * Project-wide vertical tube (schema v7 only). Phase 1 stores just the list -
 * no marker/route keys yet (phase 6) - so duplicate ids are rejected outright
 * (schema-level `.refine` on `shaftsArraySchema`, below) rather than dropped
 * with a warning like a per-floor item: a hand-written v7 file is the only
 * source, there is nothing yet to "normalise against".
 */
export const shaftSchema = z.strictObject({
  id,
  name: z.string().trim().min(1).max(SHAFT_NAME_MAX_LENGTH),
})

/** The whole `shafts` list: bounded by `MAX_SHAFTS`, ids unique (rejects outright, not a warning - see `shaftSchema`'s doc comment). */
export const shaftsArraySchema = z
  .array(shaftSchema)
  .max(MAX_SHAFTS)
  .refine((shafts) => new Set(shafts.map((shaft) => shaft.id)).size === shafts.length, {
    message: 'shaft ids must be unique',
  })

/** Keeps the first item of every id; each repeat is dropped with one warning. */
function dedupeById<T extends { id: string }>(items: readonly T[], noun: string, warnings: string[]): T[] {
  const seenIds = new Set<string>()
  return items.filter((item) => {
    if (seenIds.has(item.id)) {
      warnings.push(`${noun} id "${item.id}" is used more than once; the repeat was dropped.`)
      return false
    }
    seenIds.add(item.id)
    return true
  })
}

/**
 * Project-wide: dedupes cable type ids (each repeat dropped with one
 * warning) and reseeds the defaults when the file carries an empty/missing
 * list. Called ONCE per file, not per floor, so a repeated type id raises
 * exactly one warning however many floors the file has.
 */
export function normaliseLoadedCableTypes(raw: { cableTypes?: CableType[] }, warnings: string[]): CableType[] {
  const dedupedTypes = dedupeById(raw.cableTypes ?? [], 'Cable type', warnings)
  // Invariant: at least one cable type always exists in memory.
  return dedupedTypes.length > 0 ? dedupedTypes : createDefaultCableTypes()
}

/**
 * Per floor: drops, each with one warning, what the app never creates - a
 * repeated hub/cable id, or a cable whose device, hub or type does not
 * resolve. `cableTypes` is the project-wide deduped list
 * (`normaliseLoadedCableTypes`); `kept` is the cameras/sensors THIS FLOOR
 * kept after their own filtering, so a cable on a dropped camera goes with
 * it. Never rejects.
 */
export function normaliseLoadedFloorCabling(
  raw: { hubs?: Hub[]; cables?: Cable[] },
  cableTypes: readonly CableType[],
  kept: { cameras: readonly PlacedCamera[]; sensors: readonly PlacedSensor[] },
  warnings: string[],
): { hubs: Hub[]; cables: Cable[] } {
  const hubs = dedupeById(raw.hubs ?? [], 'Hub', warnings)

  const ctx = {
    cameraIds: new Set(kept.cameras.map((camera) => camera.id)),
    sensorShapeById: new Map(kept.sensors.map((sensor): [string, string] => [sensor.id, sensor.shape])),
    hubIds: new Set(hubs.map((hub) => hub.id)),
    typeIds: new Set(cableTypes.map((type) => type.id)),
  }
  const cables = dedupeById(raw.cables ?? [], 'Cable', warnings).filter((cable) => {
    const problem = cableRefProblem(cable, ctx)
    if (problem) warnings.push(`Cable "${cable.id}" ${problem}; dropped.`)
    return problem === null
  })

  return { hubs, cables }
}
