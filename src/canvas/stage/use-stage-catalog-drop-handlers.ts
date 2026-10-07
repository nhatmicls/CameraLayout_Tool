import { useCallback, type DragEvent, type RefObject } from 'react'
import type Konva from 'konva'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useCameraDragDropTarget } from '../camera/use-camera-drag-drop-target'
import { useFireAlarmDeviceDragDropTarget } from '../fire-alarm/use-fire-alarm-device-drag-drop-target'
import { useSensorDragDropTarget } from '../sensor/use-sensor-drag-drop-target'

/**
 * The stage container's drag-over / drop handlers for catalog cards (camera,
 * sensor or fire-alarm device). Pulled out of `floor-plan-stage.tsx` to keep
 * that file under the project's line-count guideline.
 */
export function useStageCatalogDropHandlers(stageRef: RefObject<Konva.Stage | null>) {
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)
  const setSelectedSensorId = useEditorUiStore((s) => s.setSelectedSensorId)
  const setSelectedFireAlarmDeviceId = useEditorUiStore((s) => s.setSelectedFireAlarmDeviceId)
  const { handleDragOver: handleCameraDragOver, handleDrop: handleCameraDrop } = useCameraDragDropTarget(stageRef)
  const { handleDragOver: handleSensorDragOver, handleDrop: handleSensorDrop } = useSensorDragDropTarget(stageRef)
  const { handleDragOver: handleFireAlarmDragOver, handleDrop: handleFireAlarmDrop } = useFireAlarmDeviceDragDropTarget(stageRef)

  // Combined drag-over: each hook's handler only reacts to its own MIME type, so calling all three is safe.
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      handleCameraDragOver(e)
      handleSensorDragOver(e)
      handleFireAlarmDragOver(e)
    },
    [handleCameraDragOver, handleSensorDragOver, handleFireAlarmDragOver],
  )

  // Tries the camera payload first, then the sensor payload, then the fire-alarm payload, and
  // selects whichever one actually dropped - in select mode only: in a drawing tool Backspace /
  // Esc belong to the tool, and a selected item would be deleted by the same Backspace that
  // removes a route point.
  const handleDropOnStage = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const canSelect = useEditorUiStore.getState().toolMode === 'select'
      const newCameraId = handleCameraDrop(e)
      if (newCameraId) {
        if (canSelect) setSelectedCameraId(newCameraId)
        return
      }
      const newSensorId = handleSensorDrop(e)
      if (newSensorId) {
        if (canSelect) setSelectedSensorId(newSensorId)
        return
      }
      const newFireAlarmDeviceId = handleFireAlarmDrop(e)
      if (newFireAlarmDeviceId && canSelect) setSelectedFireAlarmDeviceId(newFireAlarmDeviceId)
    },
    [
      handleCameraDrop,
      handleSensorDrop,
      handleFireAlarmDrop,
      setSelectedCameraId,
      setSelectedSensorId,
      setSelectedFireAlarmDeviceId,
    ],
  )

  return { handleDragOver, handleDropOnStage }
}
