import { buildFireAlarmDeviceLabels, type FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'
import { hubEffectiveHeightM, type Cable, type CableEndRef, type CablePoint, type Hub } from './cable-layout-types'

/**
 * The one place cable labels and cable end positions are derived. A cable
 * stores only references; this index resolves them against the live
 * cameras / sensors / fire-alarm devices / hubs, so a moved device moves its
 * cable end.
 */

/**
 * The floor's placed fire-alarm devices plus the catalog lookup their
 * designator labels ("S1", "P1", "KP2"...) are built from. `modelById`
 * omitted = every device is labelled as an unknown model ("F{n}").
 */
export interface CableFireAlarmEnds {
  devices: readonly PlacedFireAlarmDevice[]
  modelById?: FireAlarmKindByModelId
}

export interface CableDeviceEndpoint {
  ref: CableEndRef
  x: number
  y: number
  /** "C3", "S2", "S4tx"; a fire-alarm device carries its per-kind designator ("P1", "H2"). */
  label: string
  /** The device's own mounting height, or null when it has none (every sensor and fire-alarm device, an unmounted camera). */
  mountHeightM: number | null
}

export interface CableHubEndpoint {
  hubId: string
  x: number
  y: number
  /** "H1", "R1" for a riser, "D1" for a drop. */
  label: string
  /** Height of the hub end relative to this floor; negative for a drop. */
  mountHeightM: number
  /** Cable length beyond a riser / drop, on the other floor; 0 for a plain hub. */
  extraLengthM: number
}

export interface CableEndpointIndex {
  /** Cameras in array order, then sensors in array order (a beam yields its tx then its rx end), then fire-alarm devices in array order. */
  devices: CableDeviceEndpoint[]
  hubs: CableHubEndpoint[]
  deviceByKey: ReadonlyMap<string, CableDeviceEndpoint>
  hubById: ReadonlyMap<string, CableHubEndpoint>
}

/** Map key of a device end. `kind` and `end` come from fixed sets and sit at the two ends of the key, so two different refs never share one. */
export function cableEndRefKey(ref: CableEndRef): string {
  const end = ref.kind === 'sensor' ? (ref.end ?? '') : ''
  return `${ref.kind}\u0000${ref.id}\u0000${end}`
}

/** Keeps the FIRST entry of a repeated key: camera ids are not deduped on load, so a ref resolves to the first match. */
function firstWinsMap<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    const key = keyOf(item)
    if (!map.has(key)) map.set(key, item)
  }
  return map
}

const HUB_LABEL_PREFIX = { hub: 'H', riser: 'R', drop: 'D' }

/**
 * Label of every hub, by position: plain hubs are "H1", "H2"..., risers
 * "R1"..., drops "D1"... - each kind counted on its own. A shaft marker is
 * "T{n}", n = that shaft's 1-based position in the PROJECT'S `shafts[]`
 * list (passed in as `shaftIds`, in order) - NOT a local per-floor count,
 * so the same shaft reads identically on every floor it opens onto.
 * `shaftIds` omitted (every call site before phase 6, plus any that never
 * sees a shaft marker) falls back to counting shaft markers by floor-local
 * position - only ever wrong if that floor actually holds one, which no
 * pre-phase-6 caller's hubs ever did.
 */
export function hubLabels(hubs: readonly Hub[], shaftIds?: readonly string[]): string[] {
  const counts = { hub: 0, riser: 0, drop: 0, shaft: 0 }
  return hubs.map((hub) => {
    const kind = hub.kind ?? 'hub'
    if (kind === 'shaft') {
      const projectIndex = hub.shaftId ? shaftIds?.indexOf(hub.shaftId) : undefined
      if (projectIndex !== undefined && projectIndex >= 0) return `T${projectIndex + 1}`
      counts.shaft += 1
      return `T${counts.shaft}`
    }
    counts[kind] += 1
    return `${HUB_LABEL_PREFIX[kind]}${counts[kind]}`
  })
}

export function buildCableEndpointIndex(
  cameras: readonly PlacedCamera[],
  sensors: readonly PlacedSensor[],
  hubs: readonly Hub[],
  shaftIds?: readonly string[],
  fireAlarm?: CableFireAlarmEnds,
): CableEndpointIndex {
  const devices: CableDeviceEndpoint[] = cameras.map((camera, i) => ({
    ref: { kind: 'camera', id: camera.id },
    x: camera.x,
    y: camera.y,
    label: `C${i + 1}`,
    mountHeightM: camera.mountHeightM ?? null,
  }))

  sensors.forEach((sensor, i) => {
    const label = `S${i + 1}`
    if (sensor.shape === 'beam') {
      devices.push(
        { ref: { kind: 'sensor', id: sensor.id, end: 'tx' }, x: sensor.x, y: sensor.y, label: `${label}tx`, mountHeightM: null },
        { ref: { kind: 'sensor', id: sensor.id, end: 'rx' }, x: sensor.x2, y: sensor.y2, label: `${label}rx`, mountHeightM: null },
      )
    } else {
      devices.push({ ref: { kind: 'sensor', id: sensor.id }, x: sensor.x, y: sensor.y, label, mountHeightM: null })
    }
  })

  if (fireAlarm) {
    const fireAlarmLabels = buildFireAlarmDeviceLabels(fireAlarm.devices, fireAlarm.modelById ?? {})
    fireAlarm.devices.forEach((device, i) => {
      devices.push({ ref: { kind: 'fire-alarm', id: device.id }, x: device.x, y: device.y, label: fireAlarmLabels[i], mountHeightM: null })
    })
  }

  const labels = hubLabels(hubs, shaftIds)
  const hubEndpoints: CableHubEndpoint[] = hubs.map((hub, i) => ({
    hubId: hub.id,
    x: hub.x,
    y: hub.y,
    label: labels[i],
    mountHeightM: hubEffectiveHeightM(hub),
    extraLengthM: hub.extraLengthM ?? 0,
  }))

  return {
    devices,
    hubs: hubEndpoints,
    deviceByKey: firstWinsMap(devices, (device) => cableEndRefKey(device.ref)),
    hubById: firstWinsMap(hubEndpoints, (hub) => hub.hubId),
  }
}

/** Full route in image px: [device, ...intermediate points, hub]. null = the device or the hub no longer exists. */
export function resolveCablePathPx(cable: Cable, index: CableEndpointIndex): CablePoint[] | null {
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const hub = index.hubById.get(cable.hubId)
  if (!device || !hub) return null
  return [{ x: device.x, y: device.y }, ...cable.points, { x: hub.x, y: hub.y }]
}

/**
 * "C3-H1", "S2-H1", "S4tx-H1", "P1-H1"; "?" stands in for an end that no longer
 * exists. `exitFloorLabel` (e.g. "F3") appends the shaft exit a cable is
 * using - "C1-T1>F3" - shown only by callers that know the cable ends on a
 * shaft with several exits (the floor-position label needs the whole
 * project, not just this one floor's `index`, so the caller resolves it).
 */
export function cableLabel(cable: Cable, index: CableEndpointIndex, exitFloorLabel?: string): string {
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const hub = index.hubById.get(cable.hubId)
  const base = `${device?.label ?? '?'}-${hub?.label ?? '?'}`
  return exitFloorLabel ? `${base}>${exitFloorLabel}` : base
}
