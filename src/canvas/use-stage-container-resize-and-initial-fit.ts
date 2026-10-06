import { useEffect, useRef, type RefObject } from 'react'
import type { Project } from '../domain/project-types'

/**
 * Pulled out of `floor-plan-stage.tsx` (pure move, no behaviour change):
 * keeps the Konva stage sized to its flex container via a ResizeObserver
 * (written to `editor-ui-store`, not local state, so the toolbar's zoom/fit
 * buttons can use the same size) and fits a newly loaded image into view
 * once the container size is known.
 */
export function useStageContainerResizeAndInitialFit(
  containerRef: RefObject<HTMLDivElement | null>,
  image: Project['image'] | null,
  stageSize: { width: number; height: number },
  fitToView: () => void,
  setStageSize: (size: { width: number; height: number }) => void,
): void {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, setStageSize])

  // Fit the plan to the view whenever a new image is loaded (and we already know the container size).
  const fileNameRef = useRef<string | null>(null)
  useEffect(() => {
    if (!image || stageSize.width === 0 || stageSize.height === 0) return
    if (fileNameRef.current === image.fileName) return
    fileNameRef.current = image.fileName
    fitToView()
  }, [image, stageSize, fitToView])
}
