import { useCallback, useState } from 'react'
import { useProjectStore } from '../state/project-store'
import { useEditorUiStore } from '../state/editor-ui-store'
import { exportPlanPng } from './export-plan-png'
import { exportBomCsv } from './export-bom-csv'

/**
 * PNG/CSV export handlers, pulled out of `app.tsx` (pure move, no behaviour
 * change) to keep that file under the project's line-count guideline and to
 * stop phases 5/6 (canvas rendering vs. sidebar tabs) from both needing to
 * touch `app.tsx` for export wiring. `cameras`/`walls` are read via
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
    if (!image || !decodedImage || !scale) return
    setIsExportingPng(true)
    try {
      await exportPlanPng({
        decodedImage,
        image,
        cameras: useProjectStore.getState().cameras,
        walls: useProjectStore.getState().walls,
        sensors: useProjectStore.getState().sensors,
        scale,
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
      const { cameras, sensors } = useProjectStore.getState()
      exportBomCsv({ image, cameras, sensors })
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to export the CSV.')
    }
  }, [image, pushNotification])

  return { isExportingPng, handleExportPng, handleExportCsv }
}
