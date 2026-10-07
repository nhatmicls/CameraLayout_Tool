import { useCallback, type DragEvent, type RefObject } from 'react'
import type Konva from 'konva'
import { fireAlarmModelById } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { buildPlacedFireAlarmDeviceAtDrop } from '../../domain/fire-alarm/placed-fire-alarm-device-builder-and-patch'
import { clampPointToImageBounds } from '../../domain/shared/clamp'
import { useProjectStore } from '../../state/project-store'

/** Custom MIME type set by a fire-alarm catalog card's `dragstart` (phase 7) - parallel to `CAMERA_MODEL_DRAG_MIME_TYPE`/`SENSOR_MODEL_DRAG_MIME_TYPE`. */
export const FIRE_ALARM_MODEL_DRAG_MIME_TYPE = 'application/x-fire-alarm-model-id'

/**
 * HTML5 drag-and-drop target handlers for dropping a fire-alarm catalog card
 * onto the stage - the fire-alarm twin of `use-sensor-drag-drop-target.ts`.
 * Only the fire-alarm custom MIME payload is accepted; the model id is
 * looked up in the fire-alarm catalog map and unknown ids are ignored.
 * Nothing happens without a scale, same rule as camera/sensor drops (CLAUDE.md:
 * one rule for every catalog drop). Unlike camera/sensor, the drop point is
 * clamped to the image bounds: a fire-alarm device has no geometry of its
 * own to keep partly off-plan (just a marker, phase 6), so clamping avoids a
 * device nobody can see or select.
 */
export function useFireAlarmDeviceDragDropTarget(stageRef: RefObject<Konva.Stage | null>) {
  const addFireAlarmDevice = useProjectStore((s) => s.addFireAlarmDevice)

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes(FIRE_ALARM_MODEL_DRAG_MIME_TYPE)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): string | null => {
      const modelId = e.dataTransfer.getData(FIRE_ALARM_MODEL_DRAG_MIME_TYPE)
      if (!modelId) return null
      e.preventDefault()

      const model = fireAlarmModelById(modelId)
      const stage = stageRef.current
      const { scale, image } = useProjectStore.getState()
      if (!model || !scale || !stage || !image) return null

      stage.setPointersPositions(e)
      const point = stage.getRelativePointerPosition()
      if (!point) return null

      const clamped = clampPointToImageBounds(point, image.widthPx, image.heightPx)
      const device = buildPlacedFireAlarmDeviceAtDrop({
        id: crypto.randomUUID(),
        modelId: model.id,
        x: clamped.x,
        y: clamped.y,
      })
      addFireAlarmDevice(device)
      return device.id
    },
    [addFireAlarmDevice, stageRef],
  )

  return { handleDragOver, handleDrop }
}
