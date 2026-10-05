import { useEffect } from 'react'
import { useProjectStore } from './project-store'

/**
 * Global Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y (redo) shortcuts.
 * Ignored while the user is typing in a form field (e.g. the properties
 * panel's range/rotation inputs), matching
 * `use-camera-selection-keyboard-shortcuts.ts`'s convention.
 */
export function useUndoRedoKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (isTyping) return
      if (!(e.ctrlKey || e.metaKey)) return

      const key = e.key.toLowerCase()
      const temporal = useProjectStore.temporal.getState()

      if (key === 'z' && e.shiftKey) {
        e.preventDefault()
        temporal.redo()
      } else if (key === 'z') {
        e.preventDefault()
        temporal.undo()
      } else if (key === 'y') {
        e.preventDefault()
        temporal.redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
