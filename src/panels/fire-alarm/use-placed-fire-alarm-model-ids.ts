import { useMemo } from 'react'
import { useProjectStore } from '../../state/project-store'

/**
 * Set of catalog model ids with >= 1 placed `PlacedFireAlarmDevice` in this
 * project - feeds the shared "works with" drop-down's "Placed in this
 * project" `<optgroup>` (`groupControllerOptionsByPlacement`) across the
 * Sensors, Fire alarm and Control panel tabs. Memoised on the store's own
 * `fireAlarmDevices` reference so it only rebuilds when a device is added,
 * moved or removed - not on every unrelated store update.
 */
export function usePlacedFireAlarmModelIds(): ReadonlySet<string> {
  const fireAlarmDevices = useProjectStore((s) => s.fireAlarmDevices)
  return useMemo(() => new Set(fireAlarmDevices.map((device) => device.modelId)), [fireAlarmDevices])
}
