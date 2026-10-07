import { useCallback } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { useSelectionDeleteKeyboardShortcuts } from '../shared/use-selection-delete-keyboard-shortcuts'

/**
 * Delete/Backspace removes the selected sensor; Esc deselects. Twin
 * alongside `use-camera-selection-keyboard-shortcuts.ts` /
 * `use-wall-selection-keyboard-shortcuts.ts` (camera/wall keep their own
 * bodies - no shared abstraction there); this one and the fire-alarm device
 * twin (`use-fire-alarm-device-selection-keyboard-shortcuts.ts`) share
 * `useSelectionDeleteKeyboardShortcuts` since their bodies are identical
 * (selected id + delete + clear).
 */
export function useSensorSelectionKeyboardShortcuts(): void {
  const selectedSensorId = useEditorUiStore((s) => s.selectedSensorId)
  const deleteSensor = useProjectStore((s) => s.deleteSensor)
  const setSelectedSensorId = useEditorUiStore((s) => s.setSelectedSensorId)
  const clearSelection = useCallback(() => setSelectedSensorId(null), [setSelectedSensorId])

  useSelectionDeleteKeyboardShortcuts(selectedSensorId, deleteSensor, clearSelection)
}
