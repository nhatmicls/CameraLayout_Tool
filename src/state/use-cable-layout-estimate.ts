import { EMPTY_CABLE_LAYOUT_ESTIMATE, type CableLayoutEstimate } from '../domain/cable/cable-layout-estimate'
import { useProjectStore } from './project-store'
import { useProjectCableEstimate } from './use-project-cable-estimate'

/**
 * The active floor's own slice of `useProjectCableEstimate()` - same
 * return shape as before this phase, so every existing consumer (cable
 * properties panel, estimate panel/totals table) needs no change, while
 * now correctly including any cross-floor (linked riser/drop) contribution.
 * Recomputed only when the underlying project estimate or the active floor
 * changes (that hook's own `useMemo`, not a second one here).
 */
export function useCableLayoutEstimate(): CableLayoutEstimate {
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  const projectEstimate = useProjectCableEstimate()
  return projectEstimate.byFloorId.get(activeFloorId) ?? EMPTY_CABLE_LAYOUT_ESTIMATE
}
