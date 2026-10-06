import { useEffect } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * Delete/Backspace removes the selected camera; Esc deselects. Ignored
 * while the user is typing in an input/textarea elsewhere on the page
 * (e.g. the calibration-length dialog).
 */
export function useCameraSelectionKeyboardShortcuts(): void {
  const deleteCamera = useProjectStore((s) => s.deleteCamera)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (isTyping) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useEditorUiStore.getState().selectedCameraId
        if (id) {
          deleteCamera(id)
          setSelectedCameraId(null)
        }
      } else if (e.key === 'Escape') {
        setSelectedCameraId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteCamera, setSelectedCameraId])
}
