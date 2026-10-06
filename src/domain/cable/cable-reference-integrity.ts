import type { Cable } from './cable-layout-types'

/**
 * Keeps cable references coherent: shared by the project-file loader (drop a
 * cable whose device / hub / type is missing) and the store's cascade deletes.
 * The `remove*` helpers return the SAME array when nothing matched, so a
 * project without cables keeps its array identity through a delete.
 */

export function cableRefersToDevice(cable: Cable, kind: 'camera' | 'sensor', id: string): boolean {
  return cable.device.kind === kind && cable.device.id === id
}

/** Removes every cable of the device, including both the tx and rx cables of a beam. */
export function removeCablesOfDevice(cables: Cable[], kind: 'camera' | 'sensor', id: string): Cable[] {
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

export interface CableRefContext {
  cameraIds: ReadonlySet<string>
  /** Placed shape (`sector` / `circle` / `beam`) of every placed sensor, by sensor id. */
  sensorShapeById: ReadonlyMap<string, string>
  hubIds: ReadonlySet<string>
  typeIds: ReadonlySet<string>
}

/** null = every reference resolves; otherwise a human-readable reason. A beam ref needs `end`; any other sensor must not carry one. */
export function cableRefProblem(cable: Cable, ctx: CableRefContext): string | null {
  if (!ctx.hubIds.has(cable.hubId)) return `references unknown hub "${cable.hubId}"`
  if (!ctx.typeIds.has(cable.typeId)) return `references unknown cable type "${cable.typeId}"`

  const { device } = cable
  if (device.kind === 'camera') {
    return ctx.cameraIds.has(device.id) ? null : `references unknown camera "${device.id}"`
  }

  const shape = ctx.sensorShapeById.get(device.id)
  if (shape === undefined) return `references unknown sensor "${device.id}"`
  if (shape === 'beam' && device.end === undefined) return `connects to beam sensor "${device.id}" without naming an end`
  if (shape !== 'beam' && device.end !== undefined) return `names a beam end on sensor "${device.id}", which is not a beam`
  return null
}
