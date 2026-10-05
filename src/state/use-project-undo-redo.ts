import { useStore } from 'zustand'
import { useProjectStore } from './project-store'

/**
 * Subscribes a component to the zundo temporal store (`useProjectStore.temporal`,
 * a plain vanilla zustand store - see `project-store.ts`) and exposes
 * `canUndo`/`canRedo` plus the `undo`/`redo` actions themselves. The single
 * place both the toolbar buttons and the global keyboard shortcut
 * (`use-undo-redo-keyboard-shortcuts.ts`) go through, so they can never
 * drift apart.
 */
export function useProjectUndoRedo() {
  const temporalStore = useProjectStore.temporal
  const canUndo = useStore(temporalStore, (s) => s.pastStates.length > 0)
  const canRedo = useStore(temporalStore, (s) => s.futureStates.length > 0)

  return {
    canUndo,
    canRedo,
    undo: () => temporalStore.getState().undo(),
    redo: () => temporalStore.getState().redo(),
  }
}
