import { useMemo } from 'react'
import { useProjectStore } from '../../state/project-store'

/**
 * Set of catalog model ids with >= 1 placed `PlacedFireAlarmDevice' on ANY
 * floor of this project (one panel/hub can serve the whole building, so
 * "placed" is building-wide, not per floor - see the plan's drift
 * addendum) - feeds the shared "works with" drop-down's "Placed in this
 * project" `<optgroup>` (`groupControllerOptionsByPlacement`) across the
 * Sensors, Fire alarm and Control panel tabs. Memoised on the store's own
 * `floors` reference so it only rebuilds when a device (on any floor) is
 * added, moved or removed - not on every unrelated store update.
 */
export function usePlacedFireAlarmModelIds(): ReadonlySet<string> {
  const floors = useProjectStore((s) => s.floors)
  return useMemo(
    () => new Set(floors.flatMap((floor) => floor.fireAlarmDevices).map((device) => device.modelId)),
    [floors],
  )
}
