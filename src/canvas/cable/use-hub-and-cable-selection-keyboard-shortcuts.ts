import { useEffect } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { isTypingTarget } from '../shared/is-typing-target'

/**
 * Delete/Backspace removes the selected hub (with its cables, one undo step)
 * or the selected cable; Esc deselects. Twin of the wall / camera / sensor
 * hooks: the five selections are mutually exclusive, so only one of them
 * ever acts. Select mode only - in cable mode the drawing overlay owns
 * Backspace and Esc. Ignored while the user is typing in an input/textarea.
 */
export function useHubAndCableSelectionKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      const { toolMode, selectedHubId, selectedCableId, setSelectedHubId, setSelectedCableId } = useEditorUiStore.getState()
      if (toolMode !== 'select') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedHubId) {
          useProjectStore.getState().deleteHub(selectedHubId)
          setSelectedHubId(null)
        } else if (selectedCableId) {
          useProjectStore.getState().deleteCable(selectedCableId)
          setSelectedCableId(null)
        }
      } else if (e.key === 'Escape') {
        if (selectedHubId) setSelectedHubId(null)
        if (selectedCableId) setSelectedCableId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
