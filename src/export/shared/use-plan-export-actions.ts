import { useCallback, useState } from 'react'
import { useProjectStore } from '../../state/project-store'
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
 * these callbacks to be recreated.
 */
export function usePlanExportActions() {
  const image = useProjectStore((s) => s.image)
  const scale = useProjectStore((s) => s.scale)
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
      const { cameras, walls, sensors, hubs, cables, cableTypes, cableSettings, fireAlarmDevices, fireAlarmSettings } =
        useProjectStore.getState()
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
      const { cameras, sensors, fireAlarmDevices, hubs, cables, cableTypes, cableSettings, scale: currentScale } = useProjectStore.getState()
      exportBomCsv({ image, cameras, sensors, fireAlarmDevices, hubs, cables, cableTypes, cableSettings, scale: currentScale })
      if (cables.length > 0 && !currentScale) {
        pushNotification('warning', 'Cable rows were left out of the CSV: set the scale first.')
      }
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export the CSV.')
    }
  }, [image, pushNotification])

  return { isExportingPng, handleExportPng, handleExportCsv }
}
