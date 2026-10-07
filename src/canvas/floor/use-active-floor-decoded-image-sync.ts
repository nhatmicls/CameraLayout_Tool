import { useEffect } from 'react'
import { decodeEmbeddedImage } from '../../file-io/browser/decode-image-data-url'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectImage } from '../../state/project-store-floor-selectors'

/**
 * The ONLY writer of a non-null `decodedImage` in `editor-ui-store`. Mounted
 * once in `App`: watches the active floor's image data URL and decodes it
 * into the `HTMLImageElement` the canvas layer and PNG export reuse.
 * `project-store-to-editor-ui-sync.ts` sets `decodedImage` to `null`
 * synchronously whenever the active floor's image identity changes (a floor
 * switch or a `setImage` call) - this effect then decodes the new one. A
 * cancel flag guards against a stale decode finishing after a second image
 * change (rapid floor switches, or load-then-replace) has superseded it.
 */
export function useActiveFloorDecodedImageSync(): void {
  const dataUrl = useProjectStore((state) => selectImage(state)?.dataUrl ?? null)
  const setDecodedImage = useEditorUiStore((state) => state.setDecodedImage)
  const pushNotification = useEditorUiStore((state) => state.pushNotification)

  useEffect(() => {
    if (dataUrl === null) return
    let cancelled = false
    decodeEmbeddedImage(dataUrl)
      .then((element) => {
        // Belt-and-suspenders alongside `cancelled`: only commit if the active floor's data URL
        // is STILL the one this decode started for (it can't go stale and silently overwrite a
        // newer bitmap even if some future change reorders effect cleanup vs. a direct `setState`).
        if (!cancelled && selectImage(useProjectStore.getState())?.dataUrl === dataUrl) setDecodedImage(element)
      })
      .catch((err: unknown) => {
        if (!cancelled) pushNotification('error', err instanceof Error ? err.message : 'Failed to decode the floor plan image.')
      })
    return () => {
      cancelled = true
    }
  }, [dataUrl, setDecodedImage, pushNotification])
}
