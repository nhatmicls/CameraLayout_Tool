import { cableEndRefKey } from '../domain/cable/cable-endpoint-index'
import {
  MAX_CABLES,
  MAX_CABLE_TYPES,
  MAX_HUBS,
  type Cable,
  type CableLayout,
  type CableSettings,
  type CableType,
  type Hub,
} from '../domain/cable/cable-layout-types'
import { isCableTypeInUseOnAnyFloor, removeCablesOfHub } from '../domain/cable/cable-reference-integrity'

/**
 * The cable slice of the project store: hubs, cables, cable types and the
 * estimate allowances. Split out of `project-store.ts` to keep that file
 * under 200 lines.
 *
 * zundo records an undo step for EVERY `set()`, so each action checks ids and
 * no-op patches before calling it: a refused edit leaves the history alone.
 * Callers pass already-clamped values (the panels clamp through their
 * inputs); the store does not re-validate ranges, same as for cameras.
 */
export interface CablingState extends CableLayout {
  /** Every floor's cables (the active floor's own included) - used only to check cross-floor cable-type usage before a delete; a SHIP-BLOCKER fix (a type used on another, inactive floor must still refuse the delete). Never written back by any action. */
  allFloorsCables: readonly Cable[][]
}

export interface CablingActions {
  /** No-op at `MAX_HUBS`. */
  addHub: (hub: Hub) => void
  updateHub: (id: string, patch: Partial<Omit<Hub, 'id'>>) => void
  /** Removes the hub and every cable ending on it, as one undo step. */
  deleteHub: (id: string) => void
  /** No-op at `MAX_CABLES`, or when the hub or the type is unknown. */
  addCable: (cable: Cable) => void
  updateCable: (id: string, patch: Partial<Pick<Cable, 'typeId' | 'points'>>) => void
  deleteCable: (id: string) => void
  /** No-op at `MAX_CABLE_TYPES`. */
  addCableType: (type: CableType) => void
  updateCableType: (id: string, patch: Partial<Omit<CableType, 'id'>>) => void
  /** False (state untouched) when the type is in use, unknown, or the last one. */
  deleteCableType: (id: string) => boolean
  updateCableSettings: (patch: Partial<CableSettings>) => void
}

/** Returns the patched object, or the SAME object when no key actually changes (arrays such as `points` are compared by reference). An `undefined` patch value is ignored, never written. */
function applyPatchIfChanged<T extends object>(current: T, patch: Partial<T>): T {
  const changedKeys = (Object.keys(patch) as Array<keyof T>).filter((key) => patch[key] !== undefined && patch[key] !== current[key])
  if (changedKeys.length === 0) return current
  const next = { ...current }
  for (const key of changedKeys) next[key] = patch[key] as T[keyof T]
  return next
}

/** Patches the item with `id`; returns the SAME array when the id is unknown or nothing changes. */
function patchItemById<T extends { id: string }>(items: T[], id: string, patch: NoInfer<Partial<T>>): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return items
  const updated = applyPatchIfChanged(items[index], patch)
  return updated === items[index] ? items : items.map((item, i) => (i === index ? updated : item))
}

export function createCablingActions(set: (partial: Partial<CablingState>) => void, get: () => CablingState): CablingActions {
  return {
    addHub: (hub) => {
      const { hubs } = get()
      if (hubs.length >= MAX_HUBS) return
      set({ hubs: [...hubs, hub] })
    },

    updateHub: (id, patch) => {
      const { hubs } = get()
      const updated = patchItemById(hubs, id, patch)
      if (updated !== hubs) set({ hubs: updated })
    },

    deleteHub: (id) => {
      const { hubs, cables } = get()
      if (!hubs.some((hub) => hub.id === id)) return
      set({ hubs: hubs.filter((hub) => hub.id !== id), cables: removeCablesOfHub(cables, id) })
    },

    addCable: (cable) => {
      const { cables, hubs, cableTypes } = get()
      if (cables.length >= MAX_CABLES) return
      // Exactly one end: a hub of this floor, or a device (snapped by the drawing tool; a leg or
      // a cable whose end later disappears is handled by the delete cascades).
      if ((cable.hubId === undefined) === (cable.endDevice === undefined)) return
      if (cable.endDevice && cableEndRefKey(cable.endDevice) === cableEndRefKey(cable.device)) return
      if (cable.hubId !== undefined && !hubs.some((hub) => hub.id === cable.hubId)) return
      if (!cableTypes.some((type) => type.id === cable.typeId)) return
      set({ cables: [...cables, cable] })
    },

    updateCable: (id, patch) => {
      const { cables, cableTypes } = get()
      if (patch.typeId !== undefined && !cableTypes.some((type) => type.id === patch.typeId)) return
      const updated = patchItemById(cables, id, patch)
      if (updated !== cables) set({ cables: updated })
    },

    deleteCable: (id) => {
      const { cables } = get()
      if (!cables.some((cable) => cable.id === id)) return
      set({ cables: cables.filter((cable) => cable.id !== id) })
    },

    addCableType: (type) => {
      const { cableTypes } = get()
      if (cableTypes.length >= MAX_CABLE_TYPES) return
      set({ cableTypes: [...cableTypes, type] })
    },

    updateCableType: (id, patch) => {
      const { cableTypes } = get()
      const updated = patchItemById(cableTypes, id, patch)
      if (updated !== cableTypes) set({ cableTypes: updated })
    },

    deleteCableType: (id) => {
      const { cableTypes, allFloorsCables } = get()
      const isKnown = cableTypes.some((type) => type.id === id)
      if (!isKnown || cableTypes.length <= 1 || isCableTypeInUseOnAnyFloor(allFloorsCables, id)) return false
      set({ cableTypes: cableTypes.filter((type) => type.id !== id) })
      return true
    },

    updateCableSettings: (patch) => {
      const { cableSettings } = get()
      const updated = applyPatchIfChanged(cableSettings, patch)
      if (updated !== cableSettings) set({ cableSettings: updated })
    },
  }
}
