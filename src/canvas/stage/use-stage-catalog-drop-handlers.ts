import { useCallback, type DragEvent, type RefObject } from 'react'
import type Konva from 'konva'
import { cameraFormFactorOf } from '../../catalog/camera/camera-catalog-loader'
import { sensorKindOf } from '../../catalog/sensor/sensor-catalog-loader'
import { VIEW_TOGGLES, isViewToggleOn } from '../../domain/view/view-config-toggle-table'
import { revealCameraFormFactorInView, revealSensorKindInView, type ViewConfig } from '../../domain/view/view-config-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectCameras, selectSensors } from '../../state/project-store-floor-selectors'
import { useCameraDragDropTarget } from '../camera/use-camera-drag-drop-target'
import { useFireAlarmDeviceDragDropTarget } from '../fire-alarm/use-fire-alarm-device-drag-drop-target'
import { useSensorDragDropTarget } from '../sensor/use-sensor-drag-drop-target'

/**
 * A card dropped while its type is hidden would land invisibly: turn that
 * type's marker toggles back on in the STORED view config and say so. The
 * note lists the toggles that changed, by their `VIEW_TOGGLES` label.
 */
function revealDroppedItemInView(reveal: (config: ViewConfig) => ViewConfig): void {
  const { viewConfig, setViewConfig, pushNotification } = useEditorUiStore.getState()
  const next = reveal(viewConfig)
  if (next === viewConfig) return
  const turnedOn = VIEW_TOGGLES.filter((t) => isViewToggleOn(next, t.key) && !isViewToggleOn(viewConfig, t.key)).map((t) => t.noteLabel)
  setViewConfig(next)
  pushNotification('info', `View: turned ${turnedOn.join(' and ')} back on so the new item is visible.`)
}

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
  // removes a route point. A dropped camera / sensor of a hidden type is revealed first, so the
  // selection that follows is never cleared as "hidden".
  const handleDropOnStage = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const canSelect = useEditorUiStore.getState().toolMode === 'select'
      const newCameraId = handleCameraDrop(e)
      if (newCameraId) {
        const modelId = selectCameras(useProjectStore.getState()).find((camera) => camera.id === newCameraId)?.modelId
        if (modelId) revealDroppedItemInView((config) => revealCameraFormFactorInView(config, cameraFormFactorOf(modelId)))
        if (canSelect) setSelectedCameraId(newCameraId)
        return
      }
      const newSensorId = handleSensorDrop(e)
      if (newSensorId) {
        const modelId = selectSensors(useProjectStore.getState()).find((sensor) => sensor.id === newSensorId)?.modelId
        if (modelId) revealDroppedItemInView((config) => revealSensorKindInView(config, sensorKindOf(modelId)))
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
