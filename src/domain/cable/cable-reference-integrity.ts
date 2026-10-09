import { cableEndRefKey } from './cable-endpoint-index'
import type { Cable, CableDeviceKind, CableEndRef } from './cable-layout-types'

/**
 * Keeps cable references coherent: shared by the project-file loader (drop a
 * cable whose device / hub / type is missing) and the store's cascade deletes.
 * The `remove*` helpers return the SAME array when nothing matched, so a
 * project without cables keeps its array identity through a delete.
 */

/** True when the device is the cable's start OR its end. */
export function cableRefersToDevice(cable: Cable, kind: CableDeviceKind, id: string): boolean {
  return (cable.device.kind === kind && cable.device.id === id) || (cable.endDevice?.kind === kind && cable.endDevice.id === id)
}

/** Removes every cable that starts or ends on the device, including both the tx and rx cables of a beam. */
export function removeCablesOfDevice(cables: Cable[], kind: CableDeviceKind, id: string): Cable[] {
  if (!cables.some((cable) => cableRefersToDevice(cable, kind, id))) return cables
  return cables.filter((cable) => !cableRefersToDevice(cable, kind, id))
}

export function removeCablesOfHub(cables: Cable[], hubId: string): Cable[] {
  if (!cables.some((cable) => cable.hubId === hubId)) return cables
  return cables.filter((cable) => cable.hubId !== hubId)
}

export function isCableTypeInUse(cables: readonly Cable[], typeId: string): boolean {
  return cables.some((cable) => cable.typeId === typeId)
}

/** Same check across EVERY floor's cables, not just one - a cable type can be in use on a floor that is not the active one. Shared by the store's `deleteCableType` guard and the cable-types editor table's per-row "in use" flag, so both agree on what "in use" means. */
export function isCableTypeInUseOnAnyFloor(floorsCables: readonly (readonly Cable[])[], typeId: string): boolean {
  return floorsCables.some((cables) => isCableTypeInUse(cables, typeId))
}

export interface CableRefContext {
  cameraIds: ReadonlySet<string>
  /** Placed shape (`sector` / `circle` / `beam`) of every placed sensor, by sensor id. */
  sensorShapeById: ReadonlyMap<string, string>
  fireAlarmDeviceIds: ReadonlySet<string>
  hubIds: ReadonlySet<string>
  typeIds: ReadonlySet<string>
}

/** null = the device ref resolves. A beam ref needs `end`; any other sensor must not carry one. */
function deviceRefProblem(device: CableEndRef, ctx: CableRefContext): string | null {
  if (device.kind === 'camera') {
    return ctx.cameraIds.has(device.id) ? null : `references unknown camera "${device.id}"`
  }
  if (device.kind === 'fire-alarm') {
    return ctx.fireAlarmDeviceIds.has(device.id) ? null : `references unknown fire-alarm device "${device.id}"`
  }

  const shape = ctx.sensorShapeById.get(device.id)
  if (shape === undefined) return `references unknown sensor "${device.id}"`
  if (shape === 'beam' && device.end === undefined) return `connects to beam sensor "${device.id}" without naming an end`
  if (shape !== 'beam' && device.end !== undefined) return `names a beam end on sensor "${device.id}", which is not a beam`
  return null
}

/**
 * null = every reference resolves; otherwise a human-readable reason. A
 * cable ends on exactly one of a hub (`hubId`) and a device (`endDevice`),
 * never on its own start. `beyondShaft` is NOT checked here - it points at
 * another floor (`pruneInvalidShaftLegs`).
 */
export function cableRefProblem(cable: Cable, ctx: CableRefContext): string | null {
  if ((cable.hubId === undefined) === (cable.endDevice === undefined)) return 'must end on exactly one hub or device'
  if (cable.hubId !== undefined && !ctx.hubIds.has(cable.hubId)) return `references unknown hub "${cable.hubId}"`
  if (!ctx.typeIds.has(cable.typeId)) return `references unknown cable type "${cable.typeId}"`

  const startProblem = deviceRefProblem(cable.device, ctx)
  if (startProblem || !cable.endDevice) return startProblem
  if (cableEndRefKey(cable.endDevice) === cableEndRefKey(cable.device)) return 'ends on its own start device'
  return deviceRefProblem(cable.endDevice, ctx)
}
