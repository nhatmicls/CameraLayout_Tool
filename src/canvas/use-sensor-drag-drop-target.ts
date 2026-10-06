import { useCallback, type DragEvent, type RefObject } from 'react'
import type Konva from 'konva'
import { sensorModelById } from '../catalog/sensor-catalog-loader'
import { buildPlacedSensorAtDrop } from '../domain/sensor-default-placement-builder'
import { useProjectStore } from '../state/project-store'

/** Custom MIME type set by a sensor catalog card's `dragstart` (phase 6) - parallel to `CAMERA_MODEL_DRAG_MIME_TYPE`. */
export const SENSOR_MODEL_DRAG_MIME_TYPE = 'application/x-sensor-model-id'

/**
 * HTML5 drag-and-drop target handlers for dropping a sensor catalog card
 * onto the stage - the sensor twin of `use-camera-drag-drop-target.ts`.
 * Only the sensor's custom MIME payload is accepted; the model id is looked
 * up in the sensor catalog map and unknown ids are ignored. Nothing happens
 * without a scale (sensor geometry needs `planPxPerMeter` for the beam's
 * default receiver offset).
 */
export function useSensorDragDropTarget(stageRef: RefObject<Konva.Stage | null>) {
  const addSensor = useProjectStore((s) => s.addSensor)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(SENSOR_MODEL_DRAG_MIME_TYPE)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): string | null => {
      const modelId = e.dataTransfer.getData(SENSOR_MODEL_DRAG_MIME_TYPE)
      if (!modelId) return null
      e.preventDefault()

      const model = sensorModelById(modelId)
      const stage = stageRef.current
      const { scale, image } = useProjectStore.getState()
      if (!model || !scale || !stage || !image) return null

      stage.setPointersPositions(e)
      const point = stage.getRelativePointerPosition()
      if (!point) return null

      const sensor = buildPlacedSensorAtDrop({
        id: crypto.randomUUID(),
        modelId: model.id,
        spec: model,
        x: point.x,
        y: point.y,
        planPxPerMeter: scale.planPxPerMeter,
        imageWidthPx: image.widthPx,
        imageHeightPx: image.heightPx,
      })
      addSensor(sensor)
      return sensor.id
    },
    [addSensor, stageRef],
  )

  return { handleDragOver, handleDrop }
}
