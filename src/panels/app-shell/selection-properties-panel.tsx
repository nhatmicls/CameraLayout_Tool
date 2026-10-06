import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { CablePropertiesPanel } from '../cable/cable-properties-panel'
import { HubPropertiesPanel } from '../cable/hub-properties-panel'
import { CameraPropertiesPanel } from '../camera/camera-properties-panel'
import { SensorPropertiesPanel } from '../sensor/sensor-properties-panel'

/**
 * Right-panel switch: the hub, cable or sensor editor when one of those is
 * selected, the camera editor otherwise (including the "nothing selected"
 * empty state, which `CameraPropertiesPanel` already owns). Selection is
 * 5-way exclusive in `editor-ui-store.ts`, so the first id that is set
 * picks the editor. A stale hub / cable id (an undo removed the item) falls
 * through to the empty state instead of leaving the area blank.
 */
export function SelectionPropertiesPanel() {
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const selectedCableId = useEditorUiStore((s) => s.selectedCableId)
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  const hubExists = useProjectStore((s) => s.hubs.some((hub) => hub.id === selectedHubId))
  const cableExists = useProjectStore((s) => s.cables.some((cable) => cable.id === selectedCableId))
  if (hubExists) return <HubPropertiesPanel />
  if (cableExists) return <CablePropertiesPanel />
  return selectedSensorId ? <SensorPropertiesPanel /> : <CameraPropertiesPanel />
}
