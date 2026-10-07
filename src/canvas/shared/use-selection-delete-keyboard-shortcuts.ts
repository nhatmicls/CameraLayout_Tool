import { useEffect } from 'react'
import { useEditorUiStore } from '../../state/editor-ui-store'

/**
 * Delete/Backspace removes the item identified by `selectedId` via
 * `onDelete`, then clears the selection via `onClear`; Esc clears without
 * deleting. Select mode only - in cable/wall/hub/riser/drop mode the drawing
 * overlay owns Backspace (e.g. to remove a route vertex), same as
 * `use-hub-and-cable-selection-keyboard-shortcuts.ts`. Ignored while the user
 * is typing in an input/textarea. Shared by every selection kind whose
 * shortcut body is exactly this (sensor, fire-alarm device) -
 * camera/wall/hub+cable keep their own twin bodies (extra behaviour: typing
 * guard variations, two ids handled at once, the cable-mode guard), so they
 * are not routed through this one (YAGNI).
 */
export function useSelectionDeleteKeyboardShortcuts(selectedId: string | null, onDelete: (id: string) => void, onClear: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isTyping = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      if (isTyping) return
      if (useEditorUiStore.getState().toolMode !== 'select') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          onDelete(selectedId)
          onClear()
        }
      } else if (e.key === 'Escape') {
        onClear()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, onDelete, onClear])
}
