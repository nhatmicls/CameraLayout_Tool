import { useEffect, useMemo } from 'react'
import { cameraFormFactorOf } from '../../catalog/camera/camera-catalog-loader'
import { sensorKindOf } from '../../catalog/sensor/sensor-catalog-loader'
import { resolveEffectiveViewConfig } from '../../domain/view/view-config-tool-mode-overrides'
import type { ViewConfig } from '../../domain/view/view-config-types'
import { isSelectionHiddenByView } from '../../domain/view/view-hidden-selection'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { getActiveFloor } from '../../state/project-store-floor-selectors'

/**
 * The view config the stage draws with: the stored one with the current
 * tool's layers forced on (computed, never stored). Also clears the
 * selection when the selected item gets hidden (`isSelectionHiddenByView`),
 * so Delete and the properties panel never act on something that is not on
 * screen. Clearing changes the effect's deps once; the second run finds
 * nothing selected and stops.
 */
export function useStageEffectiveViewConfig(): ViewConfig {
  const viewConfig = useEditorUiStore((s) => s.viewConfig)
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const selectedCameraId = useEditorUiStore((s) => s.selectedCameraId)
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const selectedCableId = useEditorUiStore((s) => s.selectedCableId)
  const selectedWallId = useEditorUiStore((s) => s.selectedWallId)
  const clearSelection = useEditorUiStore((s) => s.clearSelection)

  const effectiveViewConfig = useMemo(() => resolveEffectiveViewConfig(viewConfig, toolMode), [viewConfig, toolMode])

  // `cameras` / `sensors` are read at run time, not subscribed: a placed item's `modelId` (the
  // only thing its visibility depends on) never changes. Add them to the deps if that ever does.
  useEffect(() => {
    const { cameras, sensors } = getActiveFloor(useProjectStore.getState())
    const selection = { selectedCameraId, selectedSensorId, selectedHubId, selectedCableId, selectedWallId }
    if (isSelectionHiddenByView(selection, effectiveViewConfig, cameras, sensors, cameraFormFactorOf, sensorKindOf)) clearSelection()
  }, [effectiveViewConfig, selectedCameraId, selectedSensorId, selectedHubId, selectedCableId, selectedWallId, clearSelection])

  return effectiveViewConfig
}
