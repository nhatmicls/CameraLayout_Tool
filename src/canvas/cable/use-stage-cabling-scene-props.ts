import { useCallback, useMemo } from 'react'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import type { CablePoint } from '../../domain/cable/cable-layout-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useCableLayoutEstimate } from '../../state/use-cable-layout-estimate'
import { useProjectStore } from '../../state/project-store'
import { selectCables, selectHubs, selectScale } from '../../state/project-store-floor-selectors'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from './use-plan-scene-cabling'

/**
 * The `cabling` + `cablingInteraction` props `floor-plan-stage.tsx` passes
 * to `PlanSceneLayers`, read from the two stores. Both objects keep their
 * identity until something they hold changes, so the scene's memos work.
 */
export function useStageCablingSceneProps(): { cabling: PlanSceneCabling; cablingInteraction: PlanSceneCablingInteraction } {
  const hubs = useProjectStore(selectHubs)
  const cables = useProjectStore(selectCables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const scale = useProjectStore(selectScale)
  const updateHub = useProjectStore((s) => s.updateHub)
  const updateCable = useProjectStore((s) => s.updateCable)
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const selectedCableId = useEditorUiStore((s) => s.selectedCableId)
  const setSelectedHubId = useEditorUiStore((s) => s.setSelectedHubId)
  const setSelectedCableId = useEditorUiStore((s) => s.setSelectedCableId)
  // The active floor's own slice of the ONE project cable estimate - cross-floor (linked
  // riser/drop) contributions already resolved, so screen and PNG style over-length cables alike.
  const layoutEstimate = useCableLayoutEstimate()
  const limitStatusById = useMemo(() => {
    const statuses = new Map<string, CableLimitStatus>()
    for (const cable of layoutEstimate.cables) statuses.set(cable.cableId, cable.limitStatus)
    return statuses
  }, [layoutEstimate])

  const cabling = useMemo(
    () => ({ hubs, cables, cableTypes, cableSettings, scale, limitStatusById }),
    [hubs, cables, cableTypes, cableSettings, scale, limitStatusById],
  )

  const onHubDragEnd = useCallback((id: string, x: number, y: number) => updateHub(id, { x, y }), [updateHub])
  const onCablePointsChange = useCallback((id: string, points: CablePoint[]) => updateCable(id, { points }), [updateCable])

  const cablingInteraction = useMemo(
    () => ({
      selectedHubId,
      selectedCableId,
      onSelectHub: setSelectedHubId,
      onSelectCable: setSelectedCableId,
      onHubDragEnd,
      onCablePointsChange,
    }),
    [selectedHubId, selectedCableId, setSelectedHubId, setSelectedCableId, onHubDragEnd, onCablePointsChange],
  )

  return { cabling, cablingInteraction }
}
