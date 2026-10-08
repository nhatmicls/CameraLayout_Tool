import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedFireAlarmDevicePatch } from '../../domain/fire-alarm/placed-fire-alarm-device-builder-and-patch'
import type { PlacedCamera, Wall } from '../../domain/project-file/project-types'
import type { PlacedSensor, PlacedSensorPatch } from '../../domain/sensor/sensor-types'
import type { ViewConfig } from '../../domain/view/view-config-types'
import type { WallNode } from '../../domain/wall/wall-node-editing'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from '../cable/use-plan-scene-cabling'

/** `PlanSceneLayers`' props, split out of that file to keep it under the project's line-count guideline. */
export interface PlanSceneLayersProps {
  decodedImage: HTMLImageElement
  imageWidthPx: number
  imageHeightPx: number
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
  fireAlarmSettings: FireAlarmSettings
  planPxPerMeter: number
  /** True only with a real scale set - gates fire-detector coverage circles (never drawn against the `planPxPerMeter ?? 1` drawing fallback the caller uses for cameras/sensors). */
  scaleIsSet: boolean
  /** Hubs, cables, cable types + settings and the real scale (null = no over-length styling). */
  cabling: PlanSceneCabling
  /** Hub / cable selection and editing. Omitted (export, dev spike) = hubs and cables are a static render. */
  cablingInteraction?: PlanSceneCablingInteraction
  /** False hides every camera cone, sensor coverage shape and fire-detector coverage circle (the cable tool: routes are drawn on a clear plan). Default true. */
  coverageVisible?: boolean
  /** Which kinds of items are drawn (the caller passes the tool-effective config). Items are hidden by id, never by filtering the arrays. Default: everything. */
  viewConfig?: ViewConfig
  /** False strips drag/selection/rotation-handle wiring for a pure static render - the PNG export reuses this component that way. */
  interactive: boolean
  selectedCameraId: string | null
  selectedWallId: string | null
  selectedSensorId: string | null
  selectedFireAlarmDeviceId: string | null
  /** True only in select mode: walls can be clicked. Ignored when `interactive` is false. */
  wallsSelectable: boolean
  /** False while a drawing tool (walls, hubs, cables) is on, so a click on a camera (cameras sit ON walls) reaches the Stage as a tool click instead of grabbing the camera. Ignored when `interactive` is false. */
  markersListening?: boolean
  /** False while the trunk-drawing tool is active: the selected hub's own trunk-editing handles stay off (see `hub-and-selected-cable-nodes.tsx`). Default true. */
  trunkEditingEnabled?: boolean
  /** Needed only to size the screen-constant selection ring/rotation handle and wall click target; irrelevant (and unused) when `interactive` is false. */
  viewportScale: number
  onSelectCamera: (id: string | null) => void
  onSelectWall: (id: string) => void
  onSelectSensor: (id: string) => void
  onSelectFireAlarmDevice: (id: string) => void
  onMoveWallNode: (from: WallNode, to: WallNode) => void
  onCameraDragEnd: (id: string, x: number, y: number) => void
  onCameraRotateEnd: (id: string, rotationDeg: number) => void
  /** One commit callback covering a sensor's move, rotate and (for a beam) either end's drag. */
  onSensorCommit: (id: string, patch: PlacedSensorPatch) => void
  onFireAlarmDeviceCommit: (id: string, patch: PlacedFireAlarmDevicePatch) => void
}
