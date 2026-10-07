import { useCallback } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useProjectStore } from '../../state/project-store'
import { selectImage } from '../../state/project-store-floor-selectors'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { BUTTON_ZOOM_FACTOR, WHEEL_ZOOM_FACTOR, computeFitViewport, zoomViewportAboutPoint } from './stage-viewport-math'

/**
 * React/Konva glue for stage pan + zoom. Reads/writes `editor-ui-store`'s
 * viewport directly (no per-render React state for the live drag position -
 * Konva owns the node's x/y during a drag gesture; we only commit to the
 * store on `dragend`, per the plan's perf note for large images).
 *
 * Reads `stageSize` (container's on-screen size) and the loaded image's
 * pixel dimensions from the stores rather than taking them as arguments, so
 * both the stage itself and the toolbar's zoom/fit buttons (which have no
 * Konva refs of their own) can use the same zoom/fit logic.
 */
export function useStagePanZoom() {
  const viewport = useEditorUiStore((s) => s.viewport)
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const stageSize = useEditorUiStore((s) => s.stageSize)
  const setViewport = useEditorUiStore((s) => s.setViewport)
  const image = useProjectStore(selectImage)

  // Pan by dragging is off only in calibrate mode, which wants every press
  // interpreted as a reference-line point. Wall mode keeps it: Konva cancels
  // the click once a drag passes its drag distance (3 px by default), so a
  // pan never places a wall point - the same mechanism that stops a
  // select-mode pan from firing the Stage's deselect click.
  const draggable = toolMode !== 'calibrate'

  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = e.target.getStage()
      const pointer = stage?.getPointerPosition()
      if (!stage || !pointer) return

      const direction = e.evt.deltaY > 0 ? -1 : 1
      const factor = direction > 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR
      setViewport(zoomViewportAboutPoint(viewport, pointer, factor))
    },
    [viewport, setViewport],
  )

  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const stage = e.target.getStage()
      if (!stage) return
      setViewport({ x: stage.x(), y: stage.y(), scale: viewport.scale })
    },
    [viewport.scale, setViewport],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const pivot = { x: stageSize.width / 2, y: stageSize.height / 2 }
      setViewport(zoomViewportAboutPoint(viewport, pivot, factor))
    },
    [viewport, stageSize, setViewport],
  )

  const zoomIn = useCallback(() => zoomBy(BUTTON_ZOOM_FACTOR), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / BUTTON_ZOOM_FACTOR), [zoomBy])

  const fitToView = useCallback(() => {
    if (!image) return
    setViewport(computeFitViewport(stageSize.width, stageSize.height, image.widthPx, image.heightPx))
  }, [image, stageSize, setViewport])

  return { viewport, draggable, stageSize, handleWheel, handleDragEnd, zoomIn, zoomOut, fitToView }
}
