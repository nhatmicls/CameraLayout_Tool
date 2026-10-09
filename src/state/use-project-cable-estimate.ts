import { useMemo } from 'react'
import { computeProjectCableEstimate, type ProjectCableEstimate } from '../domain/cable/project-cable-layout-estimate'
import { fireAlarmModelSpecById } from '../export/shared/fire-alarm-compatibility-index-singleton'
import { useProjectStore } from './project-store'
import { selectProject } from './project-store-floor-selectors'

/**
 * THE one call to `computeProjectCableEstimate` for the whole app - every
 * other estimate consumer (panels, canvas, BOM, exports) reads through this
 * hook or `useCableLayoutEstimate` (the active floor's own slice of it),
 * never `computeCableLayoutEstimate` directly (that stays an internal
 * building block of `src/domain/cable`).
 */
export function useProjectCableEstimate(): ProjectCableEstimate {
  const floors = useProjectStore((s) => s.floors)
  const shafts = useProjectStore((s) => s.shafts)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const fireAlarmSettings = useProjectStore((s) => s.fireAlarmSettings)

  return useMemo(
    () => computeProjectCableEstimate(selectProject({ floors, shafts, cableTypes, cableSettings, fireAlarmSettings }), fireAlarmModelSpecById),
    [floors, shafts, cableTypes, cableSettings, fireAlarmSettings],
  )
}
