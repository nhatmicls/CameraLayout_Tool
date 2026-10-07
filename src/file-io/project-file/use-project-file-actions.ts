import { useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { cameraModels } from '../../catalog/camera/camera-catalog-loader'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { sensorModels } from '../../catalog/sensor/sensor-catalog-loader'
import type { ProjectFileLookups, SensorModelLookup, SensorModelLookupEntry } from '../../domain/project-file/project-file-schema'
import { defaultBeamEnvironment, sensorPlacementShape } from '../../domain/sensor/sensor-types'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { loadProjectFromFile, saveProjectToFile } from './project-file-save-and-load'
import { summariseProjectLoadWarnings } from './summarise-project-load-warnings'

const NO_FLOOR_HAS_AN_IMAGE_ERROR = "This project file has no plan image on any floor; open a file with at least one."

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
    // H1: gate on ANY floor having an image, not just the active one - other floors can hold
    // real work even while you happen to be looking at an image-less one.
    if (!current.floors.some((floor) => floor.image !== null)) return
    try {
      const result = saveProjectToFile({
        floors: current.floors,
        shafts: current.shafts,
        cableTypes: current.cableTypes,
        cableSettings: current.cableSettings,
        fireAlarmSettings: current.fireAlarmSettings,
      })
      if (!result.ok) {
        pushNotification('error', result.error)
        return
      }
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
      // C1: tab 1 (`floors[0]`) need not be the floor with an image - `replaceProject` itself
      // picks the first floor that actually HAS one to activate (defensive here too: the schema
      // already guarantees at least one floor has an image, so this should never fire).
      if (!outcome.project.floors.some((floor) => floor.image !== null)) {
        pushNotification('error', NO_FLOOR_HAS_AN_IMAGE_ERROR)
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
