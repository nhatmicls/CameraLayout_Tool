import { useEditorUiStore } from '../../state/editor-ui-store'
import { CameraPropertiesPanel } from '../camera/camera-properties-panel'
import { SensorPropertiesPanel } from '../sensor/sensor-properties-panel'

/**
 * Right-panel switch: shows the sensor editor when a sensor is selected,
 * the camera editor otherwise (including the "nothing selected" empty
 * state, which `CameraPropertiesPanel` already owns). Selection is 3-way
 * exclusive in `editor-ui-store.ts` (camera / wall / sensor), so checking
 * `selectedSensorId` alone is enough to pick the right editor.
 */
export function SelectionPropertiesPanel() {
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  return selectedSensorId ? <SensorPropertiesPanel /> : <CameraPropertiesPanel />
}
