import { FIRE_ALARM_KIND_DESIGNATOR_PREFIX, type FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { Hub } from '../cable/cable-layout-types'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'

/**
 * ONE allocator for every item label on a floor ("C3", "S1", "H2", "T1"...) -
 * owner decision 2026-10-09: labels on a floor are unique, and kinds that
 * share a prefix LETTER share one counter (a smoke detector and a sensor are
 * both "S", so placing a smoke detector first makes it "S1" and the sensor
 * "S2" - never two "S1"s). Every surface (canvas markers, properties panels,
 * BOM rows, PNG legend/strip, CSV, cable end labels, cable end-to-end
 * labels, warnings) must read labels from here - no other function may
 * build one.
 *
 * Counting order inside a shared prefix is FIXED, not placement order across
 * families: cameras, then fire-alarm devices (`fireAlarmDevices[]` order),
 * then sensors (`sensors[]` order), then hubs/risers/drops (`hubs[]` order).
 * A shaft marker bypasses this map entirely - its "T{n}" comes from the
 * PROJECT'S `shafts[]` order (`ctx.shaftIds`), identical on every floor it
 * opens onto, never a per-floor count (unless `shaftIds` is omitted, which
 * falls back to a LOCAL per-floor count of shaft markers only - never mixed
 * into the H/R/D counter).
 */

export const CAMERA_LABEL_PREFIX = 'C'
export const SENSOR_LABEL_PREFIX = 'S'
export const HUB_LABEL_PREFIX = { hub: 'H', riser: 'R', drop: 'D' } as const
export const SHAFT_LABEL_PREFIX = 'T'

/** Prefix of a fire-alarm device whose catalog model id is unknown (removed since save): "?1", "?2"... - owner decision 2026-10-10, was "F", which read like a floor ("F1_F1_..."). */
const UNKNOWN_FIRE_ALARM_MODEL_PREFIX = '?'

export interface FloorItemLabels {
  /** Index-aligned with `floor.cameras`. */
  cameras: string[]
  /** Index-aligned with `floor.sensors` - base label ("S3"); a beam's tx/rx suffix is appended at the use site, as before. */
  sensors: string[]
  /** Index-aligned with `floor.fireAlarmDevices`. */
  fireAlarmDevices: string[]
  /** Index-aligned with `floor.hubs` - plain/riser/drop get "H{n}"/"R{n}"/"D{n}"; a shaft marker gets "T{n}". */
  hubs: string[]
}

/** Optional context: both omitted is valid (every alarm device reads as an unknown model, every shaft marker counts floor-locally) - never required for a floor with none of either. */
export interface FloorItemLabelContext {
  /** The project's `shafts[]` ids, in order - a shaft marker's "T{n}" is this id's 1-based position here, not a local count. */
  shaftIds?: readonly string[]
  /** Catalog lookup behind a fire-alarm device's designator; omitted = every device reads as an unknown model ("?{n}"). */
  fireAlarmModelById?: FireAlarmKindByModelId
}

/**
 * The four arrays a label needs - a `Floor` satisfies this (its own fields
 * are mutable arrays, assignable to the readonly ones here), but so does a
 * plain object literal built from four separately-held arrays (every
 * pre-floor-object caller, e.g. `buildCableEndpointIndex`) - that just never
 * gets a memo hit below, since it has no stable identity across calls.
 */
export interface FloorItems {
  cameras: readonly PlacedCamera[]
  sensors: readonly PlacedSensor[]
  fireAlarmDevices: readonly PlacedFireAlarmDevice[]
  hubs: readonly Hub[]
}

interface CacheEntry {
  shaftIds: FloorItemLabelContext['shaftIds']
  fireAlarmModelById: FloorItemLabelContext['fireAlarmModelById']
  result: FloorItemLabels
}

/** One slot per floor OBJECT (not per call) - a hit requires both the same `floor` reference and the same two context refs, so a caller must pass stable refs (the floor object from the store, a memoised `shaftIds`, the catalog singleton) to actually benefit. A caller that builds a fresh `{ cameras, sensors, fireAlarmDevices, hubs }` literal each render still gets the correct result, just always recomputed. */
const floorLabelCache = new WeakMap<FloorItems, CacheEntry>()

/** Every item label on `floor`, in the fixed cross-family order described above. Pure, O(items), never mutates `floor`. */
export function buildFloorItemLabels(floor: FloorItems, ctx?: FloorItemLabelContext): FloorItemLabels {
  const shaftIds = ctx?.shaftIds
  const fireAlarmModelById = ctx?.fireAlarmModelById

  const cached = floorLabelCache.get(floor)
  if (cached && cached.shaftIds === shaftIds && cached.fireAlarmModelById === fireAlarmModelById) return cached.result

  const counts = new Map<string, number>()
  const next = (prefix: string): string => {
    const n = (counts.get(prefix) ?? 0) + 1
    counts.set(prefix, n)
    return `${prefix}${n}`
  }

  const cameras = floor.cameras.map(() => next(CAMERA_LABEL_PREFIX))

  const fireAlarmDevices = floor.fireAlarmDevices.map((device) => {
    const kind = fireAlarmModelById?.[device.modelId]?.kind
    const prefix = kind ? FIRE_ALARM_KIND_DESIGNATOR_PREFIX[kind] : UNKNOWN_FIRE_ALARM_MODEL_PREFIX
    return next(prefix)
  })

  const sensors = floor.sensors.map(() => next(SENSOR_LABEL_PREFIX))

  let localShaftCount = 0
  const hubs = floor.hubs.map((hub) => {
    const kind = hub.kind ?? 'hub'
    if (kind === 'shaft') {
      const projectIndex = hub.shaftId ? shaftIds?.indexOf(hub.shaftId) : undefined
      if (projectIndex !== undefined && projectIndex >= 0) return `${SHAFT_LABEL_PREFIX}${projectIndex + 1}`
      localShaftCount += 1
      return `${SHAFT_LABEL_PREFIX}${localShaftCount}`
    }
    return next(HUB_LABEL_PREFIX[kind])
  })

  const result: FloorItemLabels = { cameras, sensors, fireAlarmDevices, hubs }
  floorLabelCache.set(floor, { shaftIds, fireAlarmModelById, result })
  return result
}
