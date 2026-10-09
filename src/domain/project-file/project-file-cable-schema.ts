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
import { normaliseShaftMarkerShapes, pruneUnknownOrDuplicateShaftMarkers } from '../cable/shaft-integrity'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
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

const hubLinkSchema = z.strictObject({ floorId: id, hubId: id })
const hubTrunkSchema = z.strictObject({ hubId: id, points: z.array(z.strictObject({ x: coord, y: coord })).max(MAX_CABLE_POINTS) })

/**
 * `link`/`trunk` (phase 4): structural shape only - whether a link is
 * really symmetric, adjacent-floor and riser-below/drop-above, and whether
 * a trunk really targets a hub on the SAME floor of a validly linked
 * point, needs the whole `floors[]` array and is checked once every floor
 * is assembled (`pruneInvalidCrossFloorLinks`, `project-file-schema.ts`) -
 * never rejects the file, drops with a warning instead.
 *
 * D3 (phase 6 review): the shaft-shape combinations (`kind: 'shaft'` without
 * `shaftId`; a non-shaft hub carrying a stray `shaftId`; a shaft marker
 * carrying `link`) are likewise never schema-level REJECTIONS - a hand-edited
 * or future-version file with one of these shapes should still open, with
 * the offending hub/key dropped and a warning, same as every other integrity
 * violation in this file. That normalisation runs in
 * `normaliseLoadedFloorCabling` below (`normaliseShaftMarkerShapes`), not
 * here - this schema only constrains each field's own type/bounds.
 */
export const hubSchema = z.strictObject({
  id,
  kind: z.enum(['riser', 'drop', 'shaft']).optional(),
  /** Required, and only meaningful, when `kind === 'shaft'` - which project `shafts[]` entry this opening belongs to. A mismatch (missing when required, present when not) is dropped/cleared with a warning, never rejected - see `normaliseShaftMarkerShapes`. */
  shaftId: id.optional(),
  x: coord,
  y: coord,
  mountHeightM: bounded(HUB_MOUNT_HEIGHT_BOUNDS),
  extraLengthM: bounded(HUB_EXTRA_LENGTH_BOUNDS).optional(),
  link: hubLinkSchema.optional(),
  trunk: hubTrunkSchema.optional(),
})

const cableEndRefSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('camera'), id }),
  z.strictObject({ kind: z.literal('sensor'), id, end: z.enum(['tx', 'rx']).optional() }),
  z.strictObject({ kind: z.literal('fire-alarm'), id }),
])

const cablePointsSchema = z.array(z.strictObject({ x: coord, y: coord })).max(MAX_CABLE_POINTS)

/**
 * A cable ends on exactly one of `hubId` / `endDevice`, and a leg on exactly
 * one of its own - both are checked after parsing (`cableRefProblem`,
 * `pruneInvalidShaftLegs`) and dropped with a warning, never a rejection.
 * `exitFloorId` is the pre-v9 shared-exit choice: still accepted on read,
 * converted and removed by `migrateSharedShaftExitsToCableLegs`, never written.
 */
export const cableSchema = z.strictObject({
  id,
  device: cableEndRefSchema,
  hubId: id.optional(),
  endDevice: cableEndRefSchema.optional(),
  typeId: id,
  points: cablePointsSchema,
  beyondShaft: z.strictObject({ floorId: id, points: cablePointsSchema, hubId: id.optional(), endDevice: cableEndRefSchema.optional() }).optional(),
  exitFloorId: id.optional(),
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
 * Project-wide vertical tube (schema v7 only): just `{ id, name }` - its
 * markers/routes live on each floor's own `hubs[]` (`Hub.kind: 'shaft'`),
 * not here. Duplicate ids are rejected outright (schema-level `.refine` on
 * `shaftsArraySchema`, below) rather than dropped with a warning like a
 * per-floor item: a hand-written v7 file is the only source, there is
 * nothing to "normalise against".
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
 * repeated hub/cable id, a shaft-shape mismatch (D3: `normaliseShaftMarkerShapes`
 * then `pruneUnknownOrDuplicateShaftMarkers`, BOTH before the cable-ref check
 * below, so a cable on a hub either of them drops is reported by the
 * ordinary "unknown hub" cable warning rather than left dangling), or a
 * cable whose start device, end (hub or device) or type does not resolve. `cableTypes` is the
 * project-wide deduped list (`normaliseLoadedCableTypes`); `shaftIds` is the
 * project-wide `shafts[]` id set (parsed before any floor, so it is already
 * final here); `kept` is the cameras/sensors/fire-alarm devices THIS FLOOR kept after their own
 * filtering, so a cable on a dropped camera goes with it. Every warning here
 * is UNPREFIXED - the caller (`project-file-floor-schema.ts`) prefixes with
 * the floor name only when the file has more than one floor. Never rejects.
 */
export function normaliseLoadedFloorCabling(
  raw: { hubs?: Hub[]; cables?: Cable[] },
  cableTypes: readonly CableType[],
  shaftIds: ReadonlySet<string>,
  kept: { cameras: readonly PlacedCamera[]; sensors: readonly PlacedSensor[]; fireAlarmDevices: readonly PlacedFireAlarmDevice[] },
  warnings: string[],
): { hubs: Hub[]; cables: Cable[] } {
  const dedupedHubs = dedupeById(raw.hubs ?? [], 'Hub', warnings)
  const shapedHubs = normaliseShaftMarkerShapes(dedupedHubs, warnings)
  const hubs = pruneUnknownOrDuplicateShaftMarkers(shapedHubs, shaftIds, warnings)

  const ctx = {
    cameraIds: new Set(kept.cameras.map((camera) => camera.id)),
    sensorShapeById: new Map(kept.sensors.map((sensor): [string, string] => [sensor.id, sensor.shape])),
    fireAlarmDeviceIds: new Set(kept.fireAlarmDevices.map((device) => device.id)),
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
