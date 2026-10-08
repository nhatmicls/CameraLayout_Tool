import { useCallback, useState } from 'react'
import { EMPTY_CABLE_LAYOUT_ESTIMATE } from '../../domain/cable/cable-layout-estimate'
import { computeProjectCableEstimate } from '../../domain/cable/project-cable-layout-estimate'
import { describeUnestimatedCables } from '../../domain/cable/unestimated-cables-summary'
import { useProjectStore } from '../../state/project-store'
import { getActiveFloor, selectImage, selectScale } from '../../state/project-store-floor-selectors'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { resolveEffectiveViewConfig } from '../../domain/view/view-config-tool-mode-overrides'
import { exportPlanPng } from '../png/export-plan-png'
import { exportBomCsv } from '../csv/export-bom-csv'

/**
 * PNG/CSV export handlers, pulled out of `app.tsx` (pure move, no behaviour
 * change) to keep that file under the project's line-count guideline and to
 * stop phases 5/6 (canvas rendering vs. sidebar tabs) from both needing to
 * touch `app.tsx` for export wiring. The placed items and the cable layout are read via
 * `useProjectStore.getState()` at call time rather than subscribed - they
 * only matter at the instant export runs, so a camera move no longer forces
 * these callbacks to be recreated. `computeProjectCableEstimate` (the one
 * project-wide cable estimate entry point) is called directly here, a plain
 * function call at export time rather than the `useCableLayoutEstimate`/
 * `useProjectCableEstimate` hooks a render needs - same source either way.
 */
export function usePlanExportActions() {
  const image = useProjectStore(selectImage)
  const scale = useProjectStore(selectScale)
  const decodedImage = useEditorUiStore((s) => s.decodedImage)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const [isExportingPng, setIsExportingPng] = useState(false)

  const handleExportPng = useCallback(async () => {
    if (!image || !decodedImage) return
    if (!scale) {
      pushNotification('warning', 'Set the scale before exporting a PNG.')
      return
    }
    setIsExportingPng(true)
    try {
      const store = useProjectStore.getState()
      const activeFloor = getActiveFloor(store)
      const { cameras, walls, sensors, hubs, cables, fireAlarmDevices } = activeFloor
      const { cableTypes, cableSettings, fireAlarmSettings } = store
      const cableEstimate =
        computeProjectCableEstimate({ floors: store.floors, shafts: store.shafts, cableTypes, cableSettings, fireAlarmSettings }).byFloorId.get(
          activeFloor.id,
        ) ?? EMPTY_CABLE_LAYOUT_ESTIMATE
      // The drawing shows what is on screen: the stored view config with the active tool's layers forced on.
      const { viewConfig, toolMode } = useEditorUiStore.getState()
      await exportPlanPng({
        decodedImage,
        image,
        cameras,
        walls,
        sensors,
        hubs,
        cables,
        cableTypes,
        cableSettings,
        fireAlarmDevices,
        fireAlarmSettings,
        scale,
        cableEstimate,
        viewConfig: resolveEffectiveViewConfig(viewConfig, toolMode),
        onDownscaled: (widthPx, heightPx, scaleFactor) =>
          pushNotification(
            'warning',
            `Exported at ${widthPx} x ${heightPx} (${Math.round(scaleFactor * 100)}%) - browser canvas limit.`,
          ),
      })
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export the PNG.')
    } finally {
      setIsExportingPng(false)
    }
  }, [image, decodedImage, scale, pushNotification])

  const handleExportCsv = useCallback(() => {
    if (!image) return
    try {
      const store = useProjectStore.getState()
      const activeFloor = getActiveFloor(store)
      const { cameras, sensors, fireAlarmDevices, cables, scale: currentScale } = activeFloor
      const { cableTypes, cableSettings, fireAlarmSettings } = store
      const cableEstimate =
        computeProjectCableEstimate({ floors: store.floors, shafts: store.shafts, cableTypes, cableSettings, fireAlarmSettings }).byFloorId.get(
          activeFloor.id,
        ) ?? EMPTY_CABLE_LAYOUT_ESTIMATE
      exportBomCsv({ image, cameras, sensors, fireAlarmDevices, cableEstimate })
      if (cables.length > 0 && !currentScale) {
        pushNotification('warning', 'Cable rows were left out of the CSV: set the scale first.')
      }
      // HIGH fix: a cross-floor cable excluded from the estimate (unscaled partner floor, a link
      // cycle) left the CSV with no row for it at all, and no mention anywhere - warn, same
      // wording the BOM panel and the PNG legend use.
      const unestimatedNote = describeUnestimatedCables(cableEstimate.unestimatedCableCount, cableEstimate.warnings)
      if (unestimatedNote) pushNotification('warning', `${unestimatedNote} (left out of the CSV).`)
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export the CSV.')
    }
  }, [image, pushNotification])

  return { isExportingPng, handleExportPng, handleExportCsv }
}
