import { useEffect } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'

/**
 * Delete/Backspace removes the selected camera (select mode only); Esc
 * deselects in every mode. Ignored while focus is in an input / textarea /
 * select elsewhere on the page (e.g. the calibration-length dialog).
 */
export function useCameraSelectionKeyboardShortcuts(): void {
  const deleteCamera = useProjectStore((s) => s.deleteCamera)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      if (isTyping) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Select mode only: in a drawing tool Backspace belongs to the overlay (e.g. remove a route vertex).
        if (useEditorUiStore.getState().toolMode !== 'select') return
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
