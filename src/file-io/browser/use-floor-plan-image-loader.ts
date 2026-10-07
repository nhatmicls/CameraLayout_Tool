import { useCallback, useRef, type ChangeEvent } from 'react'
import { describeFloorContent, floorHasPlacedContent } from '../../domain/floor/floor-content-summary'
import {
  FLOOR_IMAGE_BUDGET_REFUSE_CHARS,
  FLOOR_IMAGE_BUDGET_WARN_CHARS,
  imageBudgetVerdict,
} from '../../domain/floor/floor-image-budget'
import { resolveImageLoadTarget } from '../../domain/floor/floor-image-load-target-resolver'
import { formatMegabytes } from '../../domain/shared/format-megabytes'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { readImageFileAsDataUrl } from './read-image-file-as-data-url'

const FLOOR_CHANGED_DURING_LOAD_MESSAGE =
  'The floor you were loading this image onto changed before it finished (you switched floors, or it was deleted). The image was NOT applied - switch back and try again.'

/**
 * Loads a user-selected floor-plan image file onto the floor that was
 * ACTIVE when the load started: confirms when that floor already has
 * placed items (naming what would be lost), decodes + validates the file
 * (`readImageFileAsDataUrl`), checks the cross-floor image-size budget
 * (`floor-image-budget.ts`), and resets the view config on success.
 *
 * C2 fix: `readImageFileAsDataUrl` is a real async operation (`FileReader`
 * + `Image.decode()`), long enough that the user can switch floors - or
 * delete the one they were on - before it resolves. `setImage` always
 * patches whichever floor is active AT CALL TIME, so applying a stale
 * decode would silently land on, and wipe, the wrong floor. Fixed by:
 * pinning `targetFloorId` BEFORE the `await`, then re-checking it against
 * FRESH state (`resolveImageLoadTarget`) right after - the confirm prompt
 * and the budget verdict are also computed from that same fresh state, not
 * whatever was captured before the await.
 */
export function useFloorPlanImageLoader() {
  const setImage = useProjectStore((s) => s.setImage)
  const setViewConfig = useEditorUiStore((s) => s.setViewConfig)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const openFileDialog = useCallback(() => fileInputRef.current?.click(), [])

  const loadImageFile = useCallback(
    async (file: File) => {
      const targetFloorId = useProjectStore.getState().activeFloorId

      try {
        // `decoded.element` goes unused here: `useActiveFloorDecodedImageSync`
        // re-decodes from the data URL it sets below, the ONLY writer of
        // `decodedImage` (so a floor switch and a replace-on-the-same-floor
        // go through one code path).
        const { image: decoded, warning } = await readImageFileAsDataUrl(file)

        // Everything from here on reads FRESH state - `targetFloorId` is the only thing
        // captured before the await.
        const freshState = useProjectStore.getState()
        if (resolveImageLoadTarget(freshState.floors, freshState.activeFloorId, targetFloorId) !== 'ok') {
          pushNotification('warning', FLOOR_CHANGED_DURING_LOAD_MESSAGE)
          return
        }
        const targetFloor = freshState.floors.find((floor) => floor.id === targetFloorId)!

        if (floorHasPlacedContent(targetFloor)) {
          const confirmMessage = `Replacing this floor's plan clears ${describeFloorContent(targetFloor)}. This can be undone. Continue?`
          if (!window.confirm(confirmMessage)) return
        }

        const verdict = imageBudgetVerdict(freshState.floors, targetFloorId, decoded.dataUrl.length)
        if (verdict === 'refuse') {
          pushNotification(
            'error',
            `This image would make the saved project file too large (over ${formatMegabytes(FLOOR_IMAGE_BUDGET_REFUSE_CHARS)} MB across all floors' images). Use a smaller image, or replace another floor's image with a smaller one first.`,
          )
          return
        }
        if (verdict === 'warn') {
          pushNotification(
            'warning',
            `The saved project file is getting large (over ${formatMegabytes(FLOOR_IMAGE_BUDGET_WARN_CHARS)} MB across all floors' images combined) - saving or reopening it may get slow.`,
          )
        }

        setImage({
          dataUrl: decoded.dataUrl,
          widthPx: decoded.widthPx,
          heightPx: decoded.heightPx,
          fileName: decoded.fileName,
        })
        setViewConfig(DEFAULT_VIEW_CONFIG) // a new plan always starts with everything shown
        if (warning) pushNotification('warning', warning)
      } catch (err) {
        pushNotification('error', err instanceof Error ? err.message : 'Failed to load the image file.')
      }
    },
    [setImage, setViewConfig, pushNotification],
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // allow re-selecting the same file later
      if (file) void loadImageFile(file)
    },
    [loadImageFile],
  )

  return { fileInputRef, openFileDialog, loadImageFile, handleFileInputChange }
}
