import { useEffect } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * Delete/Backspace removes the selected sensor; Esc deselects. Ignored
 * while the user is typing in an input/textarea. Third twin alongside
 * `use-camera-selection-keyboard-shortcuts.ts` / `use-wall-selection-keyboard-shortcuts.ts`
 * - kept as a twin on purpose (no shared abstraction): camera / wall /
 * sensor selection are mutually exclusive, so only one of the three ever acts.
 */
export function useSensorSelectionKeyboardShortcuts(): void {
  const deleteSensor = useProjectStore((s) => s.deleteSensor)
  const setSelectedSensorId = useEditorUiStore((s) => s.setSelectedSensorId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (isTyping) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useEditorUiStore.getState().selectedSensorId
        if (id) {
          deleteSensor(id)
          setSelectedSensorId(null)
        }
      } else if (e.key === 'Escape') {
        setSelectedSensorId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSensor, setSelectedSensorId])
}
