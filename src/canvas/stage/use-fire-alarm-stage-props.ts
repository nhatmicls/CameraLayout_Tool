import { useProjectStore } from '../../state/project-store'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useFireAlarmDeviceSelectionKeyboardShortcuts } from '../fire-alarm/use-fire-alarm-device-selection-keyboard-shortcuts'

/**
 * Every fire-alarm-device store read + the selection-delete shortcut that
 * `floor-plan-stage.tsx` needs, grouped into one hook so that file's own
 * body only has one line for fire-alarm devices instead of six (mirrors why
 * `use-stage-cabling-scene-props.ts` exists for hubs/cables - pulled out
 * purely to keep `floor-plan-stage.tsx` under the project's line-count
 * guideline, same reasoning as `use-cone-live-handles.ts`).
 */
export function useFireAlarmStageProps() {
  const fireAlarmDevices = useProjectStore((s) => s.fireAlarmDevices)
  const fireAlarmSettings = useProjectStore((s) => s.fireAlarmSettings)
  const updateFireAlarmDevice = useProjectStore((s) => s.updateFireAlarmDevice)
  const selectedFireAlarmDeviceId = useEditorUiStore((s) => s.selectedFireAlarmDeviceId)
  const setSelectedFireAlarmDeviceId = useEditorUiStore((s) => s.setSelectedFireAlarmDeviceId)
  useFireAlarmDeviceSelectionKeyboardShortcuts()

  return {
    fireAlarmDevices,
    fireAlarmSettings,
    updateFireAlarmDevice,
    selectedFireAlarmDeviceId,
    setSelectedFireAlarmDeviceId,
  }
}
