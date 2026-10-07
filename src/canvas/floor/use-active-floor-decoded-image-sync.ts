import { useEffect, useRef } from 'react'
import { decodeEmbeddedImage } from '../../file-io/browser/decode-image-data-url'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectImage } from '../../state/project-store-floor-selectors'

/** Drops every cache entry whose data URL no floor's image matches any more (a replaced/deleted floor's old image, or a whole project just swapped in by `replaceProject`/`resetProject`). */
function pruneStaleCacheEntries(cache: Map<string, HTMLImageElement>): void {
  const liveDataUrls = new Set(
    useProjectStore
      .getState()
      .floors.map((floor) => floor.image?.dataUrl)
      .filter((url): url is string => url !== undefined && url !== null),
  )
  for (const key of cache.keys()) {
    if (!liveDataUrls.has(key)) cache.delete(key)
  }
}

/**
 * The ONLY writer of a non-null `decodedImage` in `editor-ui-store`. Mounted
 * once in `App`: watches the active floor's image data URL and decodes it
 * into the `HTMLImageElement` the canvas layer and PNG export reuse.
 * `project-store-to-editor-ui-sync.ts` sets `decodedImage` to `null`
 * synchronously whenever the active floor's image identity changes (a floor
 * switch or a `setImage` call) - this effect then decodes the new one. A
 * cancel flag guards against a stale decode finishing after a second image
 * change (rapid floor switches, or load-then-replace) has superseded it.
 *
 * Phase 3 measured the floor-switch blank gap at ~300-900 ms on a 20+ Mpx
 * plan (`e2e/multi-floor-tabs-smoke.spec.ts`'s latency test) - over the
 * phase file's ~300 ms cache threshold, so re-decoding is skipped for a
 * data URL this hook has already decoded once: `cacheRef` keeps one
 * `HTMLImageElement` per data URL currently held by ANY floor. Switching
 * back to a floor already visited in this session then swaps
 * `decodedImage` synchronously, with no decode at all.
 *
 * Pruned by `pruneStaleCacheEntries` in TWO places, not only on a cache
 * miss: here, whenever the floor COUNT changes (covers `deleteFloor`) or
 * `loadSeq` changes (covers `replaceProject`/`resetProject`, which can swap
 * in a same-SIZED floor list whose old images are now all unused) - and
 * again right before caching a freshly decoded image, so the cache can
 * never hold more than the live floor count even between those triggers.
 */
export function useActiveFloorDecodedImageSync(): void {
  const dataUrl = useProjectStore((state) => selectImage(state)?.dataUrl ?? null)
  const floorCount = useProjectStore((state) => state.floors.length)
  const loadSeq = useProjectStore((state) => state.loadSeq)
  const setDecodedImage = useEditorUiStore((state) => state.setDecodedImage)
  const pushNotification = useEditorUiStore((state) => state.pushNotification)
  const cacheRef = useRef(new Map<string, HTMLImageElement>())

  useEffect(() => {
    pruneStaleCacheEntries(cacheRef.current)
  }, [floorCount, loadSeq])

  useEffect(() => {
    if (dataUrl === null) return

    const cached = cacheRef.current.get(dataUrl)
    if (cached) {
      setDecodedImage(cached)
      return
    }

    let cancelled = false
    decodeEmbeddedImage(dataUrl)
      .then((element) => {
        // Belt-and-suspenders alongside `cancelled`: only commit if the active floor's data URL
        // is STILL the one this decode started for (it can't go stale and silently overwrite a
        // newer bitmap even if some future change reorders effect cleanup vs. a direct `setState`).
        if (cancelled || selectImage(useProjectStore.getState())?.dataUrl !== dataUrl) return

        pruneStaleCacheEntries(cacheRef.current)
        cacheRef.current.set(dataUrl, element)

        setDecodedImage(element)
      })
      .catch((err: unknown) => {
        if (!cancelled) pushNotification('error', err instanceof Error ? err.message : 'Failed to decode the floor plan image.')
      })
    return () => {
      cancelled = true
    }
  }, [dataUrl, setDecodedImage, pushNotification])
}
