import { buildFloorItemLabels, type FloorItemLabelContext } from '../floor/floor-item-label-allocator'
import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'
import { hubEffectiveHeightM, type Cable, type CableEndRef, type CablePoint, type Hub } from './cable-layout-types'

/**
 * The one place device/hub labels ("C3", "H1") and cable end positions are
 * derived. A cable stores only references; this index resolves them against
 * the live cameras / sensors / fire-alarm devices / hubs, so a moved device
 * moves its cable end. A cable's own end-to-end label ("F1_C3_F2_H1") is a
 * different thing, built once per project by `cable-end-to-end-label.ts`,
 * which reads this index for the bare device/hub labels it carries.
 */

/**
 * The floor's placed fire-alarm devices plus the catalog lookup their
 * designator labels ("S1", "P1", "KP2"...) are built from. `modelById`
 * omitted = every device is labelled as an unknown model ("?{n}").
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
  /** A shaft opening: a cable ending here is labelled by where it goes beyond the shaft, not by this marker. */
  isShaft: boolean
}

/** Where a cable (or a leg beyond a shaft) ends: a hub or a device, resolved to its live position and label. */
export type CableEndPoint =
  | { kind: 'hub'; x: number; y: number; label: string; hub: CableHubEndpoint }
  | { kind: 'device'; x: number; y: number; label: string; device: CableDeviceEndpoint }

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

/**
 * Labels every end from the ONE shared allocator (`floor-item-label-allocator.ts`):
 * cameras, sensors, fire-alarm devices and hubs/risers/drops may share a
 * prefix letter (a smoke detector and a sensor are both "S") and are
 * numbered together across those four families - never independently per
 * family, as this function did before phase 5. `fireAlarm` omitted = no
 * fire-alarm devices counted at all (every pre-fire-alarm caller/test).
 */
export function buildCableEndpointIndex(
  cameras: readonly PlacedCamera[],
  sensors: readonly PlacedSensor[],
  hubs: readonly Hub[],
  shaftIds?: readonly string[],
  fireAlarm?: CableFireAlarmEnds,
): CableEndpointIndex {
  const fireAlarmDevices = fireAlarm?.devices ?? []
  const ctx: FloorItemLabelContext = { shaftIds, fireAlarmModelById: fireAlarm?.modelById }
  const itemLabels = buildFloorItemLabels({ cameras, sensors, fireAlarmDevices, hubs }, ctx)

  const devices: CableDeviceEndpoint[] = cameras.map((camera, i) => ({
    ref: { kind: 'camera', id: camera.id },
    x: camera.x,
    y: camera.y,
    label: itemLabels.cameras[i],
    mountHeightM: camera.mountHeightM ?? null,
  }))

  sensors.forEach((sensor, i) => {
    const label = itemLabels.sensors[i]
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
    fireAlarmDevices.forEach((device, i) => {
      devices.push({ ref: { kind: 'fire-alarm', id: device.id }, x: device.x, y: device.y, label: itemLabels.fireAlarmDevices[i], mountHeightM: null })
    })
  }

  const hubEndpoints: CableHubEndpoint[] = hubs.map((hub, i) => ({
    hubId: hub.id,
    x: hub.x,
    y: hub.y,
    label: itemLabels.hubs[i],
    mountHeightM: hubEffectiveHeightM(hub),
    extraLengthM: hub.extraLengthM ?? 0,
    isShaft: hub.kind === 'shaft',
  }))

  return {
    devices,
    hubs: hubEndpoints,
    deviceByKey: firstWinsMap(devices, (device) => cableEndRefKey(device.ref)),
    hubById: firstWinsMap(hubEndpoints, (hub) => hub.hubId),
  }
}

/** The end stored as `{ hubId }` or `{ endDevice }`, or null when it no longer exists (or names neither). A device end wins when both are set - the loader and the store never produce that. */
export function resolveCableEnd(end: { hubId?: string; endDevice?: CableEndRef }, index: CableEndpointIndex): CableEndPoint | null {
  if (end.endDevice) {
    const device = index.deviceByKey.get(cableEndRefKey(end.endDevice))
    return device ? { kind: 'device', x: device.x, y: device.y, label: device.label, device } : null
  }
  const hub = end.hubId === undefined ? undefined : index.hubById.get(end.hubId)
  return hub ? { kind: 'hub', x: hub.x, y: hub.y, label: hub.label, hub } : null
}

/** Full route in image px: [start device, ...intermediate points, end]. null = the start device or the end no longer exists. */
export function resolveCablePathPx(cable: Cable, index: CableEndpointIndex): CablePoint[] | null {
  const device = index.deviceByKey.get(cableEndRefKey(cable.device))
  const end = resolveCableEnd(cable, index)
  if (!device || !end) return null
  return [{ x: device.x, y: device.y }, ...cable.points, { x: end.x, y: end.y }]
}
