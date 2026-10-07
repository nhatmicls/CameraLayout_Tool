import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectCables, selectFireAlarmDevices, selectHubs, selectSensors } from '../../state/project-store-floor-selectors'
import { CablePropertiesPanel } from '../cable/cable-properties-panel'
import { HubPropertiesPanel } from '../cable/hub-properties-panel'
import { CameraPropertiesPanel } from '../camera/camera-properties-panel'
import { FireAlarmDevicePropertiesPanel } from '../fire-alarm/fire-alarm-device-properties-panel'
import { SensorPropertiesPanel } from '../sensor/sensor-properties-panel'

/**
 * Right-panel switch: the hub, cable, sensor or fire-alarm device editor
 * when one of those is selected, the camera editor otherwise (including the
 * "nothing selected" empty state, which `CameraPropertiesPanel` already
 * owns). Selection is 6-way exclusive in `editor-ui-store.ts`, so the first
 * id that is set picks the editor (an if-chain, not a ternary, now that
 * there are four ids to check). A stale hub / cable / sensor / fire-alarm
 * device id (an undo or a drop removed the item) falls through to the empty
 * state instead of leaving the area blank - `SensorPropertiesPanel` and
 * `FireAlarmDevicePropertiesPanel` only return `null` in that case, so this
 * component must not mount them on a stale id, same as hub/cable.
 */
export function SelectionPropertiesPanel() {
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const selectedCableId = useEditorUiStore((s) => s.selectedCableId)
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  const selectedFireAlarmDeviceId = useEditorUiStore((s) => s.selectedFireAlarmDeviceId)
  const hubExists = useProjectStore((s) => selectHubs(s).some((hub) => hub.id === selectedHubId))
  const cableExists = useProjectStore((s) => selectCables(s).some((cable) => cable.id === selectedCableId))
  const sensorExists = useProjectStore((s) => selectSensors(s).some((sensor) => sensor.id === selectedSensorId))
  const fireAlarmDeviceExists = useProjectStore((s) => selectFireAlarmDevices(s).some((device) => device.id === selectedFireAlarmDeviceId))

  if (hubExists) return <HubPropertiesPanel />
  if (cableExists) return <CablePropertiesPanel />
  if (sensorExists) return <SensorPropertiesPanel />
  if (fireAlarmDeviceExists) return <FireAlarmDevicePropertiesPanel />
  return <CameraPropertiesPanel />
}
