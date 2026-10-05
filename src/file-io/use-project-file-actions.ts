import { useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { cameraModels } from '../catalog/camera-catalog-loader'
import { useEditorUiStore } from '../state/editor-ui-store'
import { useProjectStore } from '../state/project-store'
import { loadProjectFromFile, saveProjectToFile } from './project-file-save-and-load'

const REPLACE_PROJECT_CONFIRM_MESSAGE = 'Opening a project discards your unsaved changes. Continue?'

/** Static for the app's lifetime (bundled catalog) - computed once, not per render/load. */
const KNOWN_MODEL_IDS = new Set(cameraModels.map((m) => m.id))

/**
 * Everything `app.tsx` needs to wire up the toolbar's "Save project" /
 * "Open project" buttons: the hidden file input's ref + change handler, the
 * save handler, and the `beforeunload` guard - all driven by
 * `editor-ui-store`'s `hasUnsavedChanges` flag. Pulled out of `app.tsx` to
 * keep that file under the project's line-count guideline.
 */
export function useProjectFileActions() {
  const replaceProject = useProjectStore((s) => s.replaceProject)
  const setDecodedImage = useEditorUiStore((s) => s.setDecodedImage)
  const hasUnsavedChanges = useEditorUiStore((s) => s.hasUnsavedChanges)
  const setHasUnsavedChanges = useEditorUiStore((s) => s.setHasUnsavedChanges)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)

  const projectFileInputRef = useRef<HTMLInputElement>(null)
  const openProjectFileDialog = useCallback(() => projectFileInputRef.current?.click(), [])

  // Warn on an actual tab close/reload, not on every internal navigation.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const handleSaveProject = useCallback(() => {
    const current = useProjectStore.getState()
    if (!current.image) return
    try {
      saveProjectToFile({ image: current.image, scale: current.scale, cameras: current.cameras })
      setHasUnsavedChanges(false)
    } catch (err) {
      pushNotification('error', err instanceof Error ? err.message : 'Failed to save the project.')
    }
  }, [setHasUnsavedChanges, pushNotification])

  const loadProjectFile = useCallback(
    async (file: File) => {
      if (hasUnsavedChanges && !window.confirm(REPLACE_PROJECT_CONFIRM_MESSAGE)) {
        return
      }
      const outcome = await loadProjectFromFile(file, KNOWN_MODEL_IDS)
      if (!outcome.ok) {
        pushNotification('error', outcome.error)
        return
      }
      replaceProject(outcome.project)
      setDecodedImage(outcome.decodedImage)
      setHasUnsavedChanges(false)
      if (outcome.warnings.length > 0) {
        pushNotification('warning', `${outcome.warnings.length} camera(s) dropped: their model is not in the current catalog.`)
      }
    },
    [hasUnsavedChanges, replaceProject, setDecodedImage, setHasUnsavedChanges, pushNotification],
  )

  const handleProjectFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = '' // allow re-selecting the same file later
      if (file) void loadProjectFile(file)
    },
    [loadProjectFile],
  )

  return { projectFileInputRef, openProjectFileDialog, handleSaveProject, handleProjectFileInputChange }
}
