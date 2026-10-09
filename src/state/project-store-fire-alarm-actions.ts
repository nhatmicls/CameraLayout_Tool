import {
  applyPlacedFireAlarmDevicePatch,
  type PlacedFireAlarmDevicePatch,
} from '../domain/fire-alarm/placed-fire-alarm-device-builder-and-patch'
import type { Cable } from '../domain/cable/cable-layout-types'
import { removeCablesOfDevice } from '../domain/cable/cable-reference-integrity'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../domain/fire-alarm/fire-alarm-device-types'
import type { FireAlarmLayout } from '../domain/project-file/project-types'

/**
 * The fire-alarm slice of the project store: placed devices and the
 * coverage-mode settings. Split out of `project-store.ts` to keep that file
 * under 200 lines, mirroring `project-store-cabling-actions.ts`.
 *
 * zundo records an undo step for EVERY `set()`, so each action checks ids
 * and no-op patches before calling it: a refused edit leaves the history
 * alone. A fire-alarm device can be a cable end, so - like `deleteCamera` /
 * `deleteSensor` - its delete prunes its cables in the same `set()` (one
 * undo step).
 */
/** The persisted `FireAlarmLayout` (`project-types.ts`) plus the active floor's `cables`, which this slice only touches in `deleteFireAlarmDevice`. */
export interface FireAlarmState extends FireAlarmLayout {
  cables: Cable[]
}

export interface FireAlarmActions {
  addFireAlarmDevice: (device: PlacedFireAlarmDevice) => void
  /** Merges `patch` into the device matching `id` via `applyPlacedFireAlarmDevicePatch`. An unknown id leaves the state (and so the undo history) untouched. */
  updateFireAlarmDevice: (id: string, patch: PlacedFireAlarmDevicePatch) => void
  /** Also removes the device's cables, in the same undo step. An unknown id leaves the state (and so the undo history) untouched - the selected id can be stale after an undo. */
  deleteFireAlarmDevice: (id: string) => void
  /** Shallow-equal patch (nothing actually changes) is a no-op. */
  setFireAlarmSettings: (patch: Partial<FireAlarmSettings>) => void
}

/**
 * Returns the patched settings, or the SAME object when no key actually
 * changes. An `undefined` patch value is ignored, never written: only
 * `changedKeys` (defined AND different from `current`) are copied onto the
 * result one at a time, never `...patch` wholesale - a `{ ...current,
 * ...patch }` spread would still write an explicit `undefined` from `patch`
 * over a defined `current` value, and `JSON.stringify` silently drops an
 * `undefined` field, producing a project file that fails strict reload.
 */
function applySettingsPatchIfChanged(current: FireAlarmSettings, patch: Partial<FireAlarmSettings>): FireAlarmSettings {
  const changedKeys = (Object.keys(patch) as Array<keyof FireAlarmSettings>).filter(
    (key) => patch[key] !== undefined && patch[key] !== current[key],
  )
  if (changedKeys.length === 0) return current
  const updated: FireAlarmSettings = { ...current }
  for (const key of changedKeys) {
    (updated as unknown as Record<string, unknown>)[key] = patch[key]
  }
  return updated
}

export function createFireAlarmActions(
  set: (partial: Partial<FireAlarmState>) => void,
  get: () => FireAlarmState,
): FireAlarmActions {
  return {
    addFireAlarmDevice: (device) => set({ fireAlarmDevices: [...get().fireAlarmDevices, device] }),

    updateFireAlarmDevice: (id, patch) => {
      const devices = get().fireAlarmDevices
      const index = devices.findIndex((device) => device.id === id)
      if (index === -1) return
      const updated = applyPlacedFireAlarmDevicePatch(devices[index], patch)
      if (updated === devices[index]) return
      set({ fireAlarmDevices: devices.map((device, i) => (i === index ? updated : device)) })
    },

    deleteFireAlarmDevice: (id) => {
      const { fireAlarmDevices, cables } = get()
      if (!fireAlarmDevices.some((device) => device.id === id)) return
      set({
        fireAlarmDevices: fireAlarmDevices.filter((device) => device.id !== id),
        cables: removeCablesOfDevice(cables, 'fire-alarm', id),
      })
    },

    setFireAlarmSettings: (patch) => {
      const { fireAlarmSettings } = get()
      const updated = applySettingsPatchIfChanged(fireAlarmSettings, patch)
      if (updated !== fireAlarmSettings) set({ fireAlarmSettings: updated })
    },
  }
}
