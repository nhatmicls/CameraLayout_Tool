import { useEffect } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * Delete/Backspace removes the selected wall; Esc deselects. Ignored while
 * the user is typing in an input/textarea. The camera twin
 * (`use-camera-selection-keyboard-shortcuts.ts`) runs alongside: camera and
 * wall selection are mutually exclusive, so only one of the two ever acts.
 */
export function useWallSelectionKeyboardShortcuts(): void {
  const deleteWall = useProjectStore((s) => s.deleteWall)
  const setSelectedWallId = useEditorUiStore((s) => s.setSelectedWallId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (isTyping) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useEditorUiStore.getState().selectedWallId
        if (id) {
          deleteWall(id)
          setSelectedWallId(null)
        }
      } else if (e.key === 'Escape') {
        setSelectedWallId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteWall, setSelectedWallId])
}
