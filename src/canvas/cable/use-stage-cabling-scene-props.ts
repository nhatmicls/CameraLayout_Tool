import { useCallback, useMemo } from 'react'
import { buildProjectCableEndToEndLabels, resolveShaftLegLabels, selectCableLabelStrings } from '../../domain/cable/cable-end-to-end-label'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import type { CablePoint } from '../../domain/cable/cable-layout-types'
import { findShaftLegsOnFloor, type ResolvedShaftLeg } from '../../domain/cable/shaft-cable-leg'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useActiveFloorCableLabels } from '../../state/use-active-floor-cable-labels'
import { useCableLayoutEstimate } from '../../state/use-cable-layout-estimate'
import { useProjectStore } from '../../state/project-store'
import { selectCables, selectHubs, selectScale } from '../../state/project-store-floor-selectors'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from './use-plan-scene-cabling'

const NO_SHAFT_LEGS: readonly ResolvedShaftLeg[] = []

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
  const shafts = useProjectStore((s) => s.shafts)
  const updateHub = useProjectStore((s) => s.updateHub)
  const updateCable = useProjectStore((s) => s.updateCable)
  const setHubTrunk = useProjectStore((s) => s.setHubTrunk)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
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

  const shaftIds = useMemo(() => shafts.map((shaft) => shaft.id), [shafts])
  // Cables of ANY floor whose own route beyond a shaft runs on the active floor.
  const floors = useProjectStore((s) => s.floors)
  const shaftLegs = useMemo(() => {
    const legs = findShaftLegsOnFloor(floors, activeFloorId, { indexCache: new Map() })
    // One shared empty list: `floors` changes on every edit, and a fresh `[]` each time would
    // needlessly invalidate `cabling` (and the cable lines) on a floor with no leg at all.
    return legs.length > 0 ? legs : NO_SHAFT_LEGS
  }, [floors, activeFloorId])
  // Active floor's own cable labels (`labelByCableId`, stable identity via `selectCableLabelStrings`'s
  // own cache) plus every leg's label, read from the SAME project-wide label map (a leg's cable may
  // belong to another floor) so the canvas text always matches the properties panel's.
  const activeFloorLabels = useActiveFloorCableLabels()
  const labelByCableId = selectCableLabelStrings(activeFloorLabels)
  const allCableLabels = buildProjectCableEndToEndLabels({ floors, shafts }, fireAlarmModelSpecById)
  const shaftLegLabels = useMemo(() => resolveShaftLegLabels(shaftLegs, floors, allCableLabels), [shaftLegs, floors, allCableLabels])
  const cabling = useMemo(
    () => ({ hubs, cables, cableTypes, cableSettings, scale, limitStatusById, shaftIds, shaftLegs, labelByCableId, shaftLegLabels }),
    [hubs, cables, cableTypes, cableSettings, scale, limitStatusById, shaftIds, shaftLegs, labelByCableId, shaftLegLabels],
  )

  const onHubDragEnd = useCallback((id: string, x: number, y: number) => updateHub(id, { x, y }), [updateHub])
  const onCablePointsChange = useCallback((id: string, points: CablePoint[]) => updateCable(id, { points }), [updateCable])
  // The target hub is never passed back by the editor - it stays whatever the hub's own LIVE trunk
  // currently points at (looked up here, not trusted from a stale closure).
  const onHubTrunkPointsChange = useCallback(
    (hubId: string, points: CablePoint[]) => {
      const hub = hubs.find((candidate) => candidate.id === hubId)
      if (!hub?.trunk) return
      setHubTrunk({ floorId: activeFloorId, hubId }, { hubId: hub.trunk.hubId, points })
    },
    [hubs, activeFloorId, setHubTrunk],
  )

  const cablingInteraction = useMemo(
    () => ({
      selectedHubId,
      selectedCableId,
      onSelectHub: setSelectedHubId,
      onSelectCable: setSelectedCableId,
      onHubDragEnd,
      onCablePointsChange,
      onHubTrunkPointsChange,
    }),
    [selectedHubId, selectedCableId, setSelectedHubId, setSelectedCableId, onHubDragEnd, onCablePointsChange, onHubTrunkPointsChange],
  )

  return { cabling, cablingInteraction }
}
