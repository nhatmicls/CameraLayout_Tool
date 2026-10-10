import { buildProjectCableEndToEndLabels, type CableEndToEndLabel } from '../domain/cable/cable-end-to-end-label'
import { fireAlarmModelSpecById } from '../export/shared/fire-alarm-compatibility-index-singleton'
import { useProjectStore } from './project-store'

const EMPTY_LABEL_MAP: ReadonlyMap<string, CableEndToEndLabel> = new Map()

/**
 * The active floor's own slice of `buildProjectCableEndToEndLabels` - cable
 * id -> its end-to-end label (`F1_C3_F2_H1`). Reads `floors`/`shafts`
 * separately (never a selector returning a fresh object) so the builder's
 * own single-slot memo stays hit across renders, same catalog singleton
 * `use-project-cable-estimate.ts` uses so that hook's memo isn't defeated
 * either.
 */
export function useActiveFloorCableLabels(): ReadonlyMap<string, CableEndToEndLabel> {
  const floors = useProjectStore((s) => s.floors)
  const shafts = useProjectStore((s) => s.shafts)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  return buildProjectCableEndToEndLabels({ floors, shafts }, fireAlarmModelSpecById).get(activeFloorId) ?? EMPTY_LABEL_MAP
}
