import { useCallback, useEffect, useRef, type ChangeEvent } from 'react'
import { cameraModels } from '../../catalog/camera/camera-catalog-loader'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { sensorModels } from '../../catalog/sensor/sensor-catalog-loader'
import { DEFAULT_FLOOR_HEIGHT_M, LEGACY_FLOOR_ID, LEGACY_FLOOR_NAME } from '../../domain/floor/floor-types'
import type { ProjectFileLookups, SensorModelLookup, SensorModelLookupEntry } from '../../domain/project-file/project-file-schema'
import type { Project } from '../../domain/project-file/project-types'
import { defaultBeamEnvironment, sensorPlacementShape } from '../../domain/sensor/sensor-types'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { loadProjectFromFile, saveProjectToFile } from './project-file-save-and-load'
import { summariseProjectLoadWarnings } from './summarise-project-load-warnings'

/** `floors.length > 1` is a file this build cannot fully open yet - only the first floor loads. */
const EXTRA_FLOORS_DROPPED_WARNING = (floorCount: number, firstFloorName: string) =>
  `This project has ${floorCount} floors; only the first ("${firstFloorName}") was opened - multi-floor projects are not supported yet.`

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
 */
export function useProjectFileActions() {
  const replaceProject = useProjectStore((s) => s.replaceProject)
  const setDecodedImage = useEditorUiStore((s) => s.setDecodedImage)
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

  // Bridge (phase 1 only, deleted once the store itself holds `floors[]` - phase 2): the store
  // stays flat, so save wraps it as a one-floor `Project` and load unwraps `floors[0]`.
  const handleSaveProject = useCallback(() => {
    const current = useProjectStore.getState()
    if (!current.image) return
    try {
      const project: Project = {
        floors: [
          {
            id: LEGACY_FLOOR_ID,
            name: LEGACY_FLOOR_NAME,
            floorHeightM: DEFAULT_FLOOR_HEIGHT_M,
            image: current.image,
            scale: current.scale,
            cameras: current.cameras,
            walls: current.walls,
            sensors: current.sensors,
            hubs: current.hubs,
            cables: current.cables,
            fireAlarmDevices: current.fireAlarmDevices,
          },
        ],
        shafts: [],
        cableTypes: current.cableTypes,
        cableSettings: current.cableSettings,
        fireAlarmSettings: current.fireAlarmSettings,
      }
      saveProjectToFile(project)
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
      const floor = outcome.project.floors[0]
      if (floor.image === null || outcome.decodedImage === null) {
        pushNotification('error', FLOOR_ZERO_HAS_NO_IMAGE_ERROR)
        return
      }
      replaceProject({
        image: floor.image,
        scale: floor.scale,
        cameras: floor.cameras,
        walls: floor.walls,
        sensors: floor.sensors,
        hubs: floor.hubs,
        cables: floor.cables,
        cableTypes: outcome.project.cableTypes,
        cableSettings: outcome.project.cableSettings,
        fireAlarmDevices: floor.fireAlarmDevices,
        fireAlarmSettings: outcome.project.fireAlarmSettings,
      })
      setDecodedImage(outcome.decodedImage)
      setViewConfig(DEFAULT_VIEW_CONFIG) // the view is not in the file: an opened project always starts with everything shown
      setHasUnsavedChanges(false)
      const warnings =
        outcome.project.floors.length > 1
          ? [EXTRA_FLOORS_DROPPED_WARNING(outcome.project.floors.length, floor.name), ...outcome.warnings]
          : outcome.warnings
      if (warnings.length > 0) {
        pushNotification('warning', summariseProjectLoadWarnings(warnings))
      }
    },
    [hasUnsavedChanges, replaceProject, setDecodedImage, setViewConfig, setHasUnsavedChanges, pushNotification],
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
