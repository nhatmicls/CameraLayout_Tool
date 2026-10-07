import { useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { cameraModels } from '../../catalog/camera/camera-catalog-loader'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { sensorModels } from '../../catalog/sensor/sensor-catalog-loader'
import type { ProjectFileLookups, SensorModelLookup, SensorModelLookupEntry } from '../../domain/project-file/project-file-schema'
import { defaultBeamEnvironment, sensorPlacementShape } from '../../domain/sensor/sensor-types'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { getActiveFloor } from '../../state/project-store-floor-selectors'
import { loadProjectFromFile, saveProjectToFile } from './project-file-save-and-load'
import { summariseProjectLoadWarnings } from './summarise-project-load-warnings'

const FLOOR_ZERO_HAS_NO_IMAGE_ERROR = "This project's first floor has no plan image; open a file whose first floor has one."

const REPLACE_PROJECT_CONFIRM_MESSAGE = 'Opening a project discards your unsaved changes. Continue?'

/** Static for the app's lifetime: what the file parser needs per sensor model (shape + beam default). */
const KNOWN_SENSOR_MODEL_LOOKUP: SensorModelLookup = new Map(
  sensorModels.map((model): [string, SensorModelLookupEntry] => [
    model.id,
    {
      shape: sensorPlacementShape(model),
      defaultBeamEnvironment: model.kind === 'beam' ? defaultBeamEnvironment(model) : undefined,
    },
  ]),
)

/** Static for the app's lifetime (bundled catalogs) - computed once, not per render/load. */
const PROJECT_FILE_LOOKUPS: ProjectFileLookups = {
  cameraModelIds: new Set(cameraModels.map((m) => m.id)),
  sensorModelLookup: KNOWN_SENSOR_MODEL_LOOKUP,
  fireAlarmModelIds: new Set(fireAlarmModels.map((m) => m.id)),
}

/**
 * Everything `app.tsx` needs to wire up the toolbar's "Save project" /
 * "Open project" buttons: the hidden file input's ref + change handler, the
 * save handler, and the `beforeunload` guard - all driven by
 * `editor-ui-store`'s `hasUnsavedChanges` flag. Pulled out of `app.tsx` to
 * keep that file under the project's line-count guideline.
 *
 * Phase 2 removed the phase-1 one-floor bridge: the store now holds the
 * real multi-floor `Project` shape directly, so save/load pass it straight
 * through. `decodedImage` is no longer set here -
 * `use-active-floor-decoded-image-sync.ts` is the only place that does.
 */
export function useProjectFileActions() {
  const replaceProject = useProjectStore((s) => s.replaceProject)
  const setViewConfig = useEditorUiStore((s) => s.setViewConfig)
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
    if (!getActiveFloor(current).image) return
    try {
      saveProjectToFile({
        floors: current.floors,
        shafts: current.shafts,
        cableTypes: current.cableTypes,
        cableSettings: current.cableSettings,
        fireAlarmSettings: current.fireAlarmSettings,
      })
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
      const outcome = await loadProjectFromFile(file, PROJECT_FILE_LOOKUPS)
      if (!outcome.ok) {
        pushNotification('error', outcome.error)
        return
      }
      // Tab 1 = the lowest floor = `floors[0]` (CLAUDE.md); `replaceProject`
      // makes it the active floor. No floor-tabs UI yet (phase 3), so a file
      // whose first floor has no image can't be shown at all.
      if (outcome.project.floors[0].image === null) {
        pushNotification('error', FLOOR_ZERO_HAS_NO_IMAGE_ERROR)
        return
      }
      replaceProject(outcome.project)
      setViewConfig(DEFAULT_VIEW_CONFIG) // the view is not in the file: an opened project always starts with everything shown
      setHasUnsavedChanges(false)
      if (outcome.warnings.length > 0) {
        pushNotification('warning', summariseProjectLoadWarnings(outcome.warnings))
      }
    },
    [hasUnsavedChanges, replaceProject, setViewConfig, setHasUnsavedChanges, pushNotification],
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
