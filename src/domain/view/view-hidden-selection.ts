/**
 * Whether the current selection points at something the view no longer
 * draws a marker / line for. The stage clears such a selection, so Delete
 * and the properties panel never act on an item that is not on screen.
 */
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor, SensorKind } from '../sensor/sensor-types'
import { computeHiddenCameraIds, computeHiddenSensorIds } from './plan-view-visibility'
import type { ViewConfig } from './view-config-types'

/** The selection ids the view can hide. At most one is set (`editor-ui-store.ts`). A fire-alarm device has no view toggle and is not listed. */
export interface ViewHideableSelection {
  selectedCameraId: string | null
  selectedSensorId: string | null
  selectedHubId: string | null
  selectedCableId: string | null
  selectedWallId: string | null
}

/**
 * True when the selected item's marker / line is hidden by `view` (pass the
 * tool-effective config). A hidden cone or coverage shape alone keeps the
 * selection - the marker is still there. A selected id that no longer exists,
 * or whose model id is unknown, is never reported as hidden.
 */
export function isSelectionHiddenByView(
  selection: ViewHideableSelection,
  view: ViewConfig,
  cameras: readonly PlacedCamera[],
  sensors: readonly PlacedSensor[],
  formFactorOf: (modelId: string) => string | undefined,
  sensorKindOf: (modelId: string) => SensorKind | undefined,
): boolean {
  if (selection.selectedHubId) return !view.hubs
  if (selection.selectedCableId) return !view.cables
  if (selection.selectedWallId) return !view.walls
  if (selection.selectedCameraId) {
    const camera = cameras.find((c) => c.id === selection.selectedCameraId)
    return camera !== undefined && computeHiddenCameraIds([camera], view, formFactorOf).markers.has(camera.id)
  }
  if (selection.selectedSensorId) {
    const sensor = sensors.find((s) => s.id === selection.selectedSensorId)
    return sensor !== undefined && computeHiddenSensorIds([sensor], view, sensorKindOf).markers.has(sensor.id)
  }
  return false
}
