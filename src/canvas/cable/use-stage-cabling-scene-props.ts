import { useCallback, useMemo } from 'react'
import type { CablePoint } from '../../domain/cable/cable-layout-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from './use-plan-scene-cabling'

/**
 * The `cabling` + `cablingInteraction` props `floor-plan-stage.tsx` passes
 * to `PlanSceneLayers`, read from the two stores. Both objects keep their
 * identity until something they hold changes, so the scene's memos work.
 */
export function useStageCablingSceneProps(): { cabling: PlanSceneCabling; cablingInteraction: PlanSceneCablingInteraction } {
  const hubs = useProjectStore((s) => s.hubs)
  const cables = useProjectStore((s) => s.cables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const scale = useProjectStore((s) => s.scale)
  const updateHub = useProjectStore((s) => s.updateHub)
  const updateCable = useProjectStore((s) => s.updateCable)
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const selectedCableId = useEditorUiStore((s) => s.selectedCableId)
  const setSelectedHubId = useEditorUiStore((s) => s.setSelectedHubId)
  const setSelectedCableId = useEditorUiStore((s) => s.setSelectedCableId)

  const cabling = useMemo(
    () => ({ hubs, cables, cableTypes, cableSettings, scale }),
    [hubs, cables, cableTypes, cableSettings, scale],
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
