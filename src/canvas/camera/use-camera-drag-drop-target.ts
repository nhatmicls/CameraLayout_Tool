import { useCallback, type DragEvent, type RefObject } from 'react'
import type Konva from 'konva'
import { cameraModelById } from '../../catalog/camera/camera-catalog-loader'
import { resolveEffectiveHfovDeg, resolveDefaultRangeM } from '../../domain/camera/camera-coverage-resolver'
import { useProjectStore } from '../../state/project-store'
import { selectScale } from '../../state/project-store-floor-selectors'
import { CAMERA_MODEL_DRAG_MIME_TYPE } from '../../panels/camera/camera-catalog-model-card'
import type { PlacedCamera } from '../../domain/project-file/project-types'

/**
 * HTML5 drag-and-drop target handlers for dropping a catalog card onto the
 * stage. Only the catalog's custom MIME payload is accepted (ignores e.g. a
 * stray file dropped on the stage); the model id is looked up in the
 * catalog map and unknown ids are ignored.
 */
export function useCameraDragDropTarget(stageRef: RefObject<Konva.Stage | null>) {
  const addCamera = useProjectStore((s) => s.addCamera)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(CAMERA_MODEL_DRAG_MIME_TYPE)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): string | null => {
      const modelId = e.dataTransfer.getData(CAMERA_MODEL_DRAG_MIME_TYPE)
      if (!modelId) return null
      e.preventDefault()

      const model = cameraModelById(modelId)
      const stage = stageRef.current
      const currentScale = selectScale(useProjectStore.getState())
      if (!model || !currentScale || !stage) return null

      stage.setPointersPositions(e)
      const point = stage.getRelativePointerPosition()
      if (!point) return null

      const hfovDeg = resolveEffectiveHfovDeg(model.lens, undefined) // widest/only angle - no override yet
      const rangeM = resolveDefaultRangeM(model, hfovDeg)
      const newCamera: PlacedCamera = {
        id: crypto.randomUUID(),
        modelId: model.id,
        x: point.x,
        y: point.y,
        rotationDeg: 0,
        rangeM,
        ...(model.lens.kind === 'varifocal' ? { hfovDeg: model.lens.hfovWideDeg } : {}),
      }
      addCamera(newCamera)
      return newCamera.id
    },
    [addCamera, stageRef],
  )

  return { handleDragOver, handleDrop }
}
