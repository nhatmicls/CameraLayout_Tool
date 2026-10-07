import { useCallback } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { useSelectionDeleteKeyboardShortcuts } from '../shared/use-selection-delete-keyboard-shortcuts'

/**
 * Delete/Backspace removes the selected fire-alarm device; Esc deselects.
 * Twin of `use-sensor-selection-keyboard-shortcuts.ts` - both share
 * `useSelectionDeleteKeyboardShortcuts` since their bodies are identical
 * (selected id + delete + clear). Camera/wall/sensor/hub/cable/fire-alarm
 * selection are mutually exclusive, so only one of the six ever acts.
 */
export function useFireAlarmDeviceSelectionKeyboardShortcuts(): void {
  const selectedFireAlarmDeviceId = useEditorUiStore((s) => s.selectedFireAlarmDeviceId)
  const deleteFireAlarmDevice = useProjectStore((s) => s.deleteFireAlarmDevice)
  const setSelectedFireAlarmDeviceId = useEditorUiStore((s) => s.setSelectedFireAlarmDeviceId)
  const clearSelection = useCallback(() => setSelectedFireAlarmDeviceId(null), [setSelectedFireAlarmDeviceId])

  useSelectionDeleteKeyboardShortcuts(selectedFireAlarmDeviceId, deleteFireAlarmDevice, clearSelection)
}
