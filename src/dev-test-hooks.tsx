import Konva from 'konva'
import { useProjectStore } from './state/project-store'
import { getActiveFloor, selectProject } from './state/project-store-floor-selectors'
import { useEditorUiStore, type UiNotification, type Viewport } from './state/editor-ui-store'
import { runExportSpike } from './dev-test-hooks-export-spike'
import type { Cable, Hub } from './domain/cable/cable-layout-types'
import { filterCompatibilityWarningsToDeviceIds } from './domain/fire-alarm/fire-alarm-compatibility-checker'
import type { Floor } from './domain/floor/floor-types'
import type { PlacedCamera, ScaleCalibration, Wall } from './domain/project-file/project-types'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from './domain/fire-alarm/fire-alarm-device-types'
import type { PlacedSensor } from './domain/sensor/sensor-types'
import { buildCombinedBomRows } from './export/shared/build-combined-bom-rows'
import { fireAlarmModelSpecById } from './export/shared/fire-alarm-compatibility-index-singleton'
import { resolveCompatibilityWarningText } from './export/png/resolve-fire-alarm-export-legend'

declare global {
  interface Window {
    /** Dev-only test seam (dead-code-eliminated from production builds - see `installDevTestHooks`'s `import.meta.env.DEV` guard). Lets a Playwright script read live store state, trigger a notification, and bulk-seed cameras/sensors without re-implementing viewport/fit math or exercising drag-and-drop dozens of times over. */
    __cameraLayoutToolTestHooks?: {
      getViewport: () => Viewport
      getScale: () => ScaleCalibration | null
      getCameras: () => PlacedCamera[]
      getWalls: () => Wall[]
      getSensors: () => PlacedSensor[]
      getHubs: () => Hub[]
      getCables: () => Cable[]
      getFireAlarmDevices: () => PlacedFireAlarmDevice[]
      getSelectedCameraId: () => string | null
      /** The selected hub, if any - lets an e2e spec confirm a click landed on a hub marker (not swallowed by an overlapping line) without relying on panel text. */
      getSelectedHubId: () => string | null
      /** Phase 3 (multi-floor tabs): the whole floor list and which one is active, for an e2e spec to assert per-floor counts/order without re-deriving them from the DOM. */
      getFloors: () => Floor[]
      getActiveFloorId: () => string
      /** Adds a floor the same way the "+" tab button does (auto-named when `name` is omitted) and returns its id. */
      seedFloor: (name?: string) => string
      /** M4: the REAL on-screen bitmap's native size (not just the active floor's own stored `image.widthPx/heightPx`) - lets an e2e spec confirm the pixels actually painted match the floor it expects, catching a C2-style "right floor, wrong bitmap" regression a mere "a canvas exists" check would miss. `null` while nothing is decoded yet. */
      getDecodedImageInfo: () => { widthPx: number; heightPx: number } | null
      pushNotification: (kind: UiNotification['kind'], message: string) => void
      /** Sets the scale directly, skipping the two-click calibration UI - needed by a browser check that must draw a metres-derived shape (a camera cone, a sensor band, a fire-detector circle) without drawing a reference line by hand. */
      setScale: (scale: ScaleCalibration) => void
      seedCamera: (camera: Omit<PlacedCamera, 'id'>) => void
      seedWall: (wall: Omit<Wall, 'id'>) => void
      seedSensor: (sensor: Omit<PlacedSensor, 'id'>) => void
      seedHub: (hub: Omit<Hub, 'id'>) => void
      seedCable: (cable: Omit<Cable, 'id'>) => void
      seedFireAlarmDevice: (device: Omit<PlacedFireAlarmDevice, 'id'>) => void
      setFireAlarmSettings: (patch: Partial<FireAlarmSettings>) => void
      runExportSpike: () => Promise<{ dataUrlLength: number; widthPx: number; heightPx: number }>
      /** Selects a hub (clears any other selection) - the right panel then shows `HubPropertiesPanel`. No canvas click needed. */
      selectHub: (id: string) => void
      /** Selects a cable (clears any other selection) - the right panel then shows `CablePropertiesPanel`. */
      selectCable: (id: string) => void
      /** Sets (or, with `trunk: null`, clears) a LINKED riser/drop's own route to another hub on its own floor. Delegates to the store's `setHubTrunk` action, one undo step. */
      setHubTrunk: (ref: { floorId: string; hubId: string }, trunk: { hubId: string; points: Array<{ x: number; y: number }> } | null) => void
      /**
       * Phase 5: converts an IMAGE px position to a client (CSS px, viewport-relative) position -
       * same coordinate space `page.mouse.click`/`page.mouse.move` expect - by combining the
       * stage container's on-screen rect with the live pan/zoom viewport. Lets an e2e spec drive
       * the real canvas with mouse events instead of re-implementing Konva's own hit-testing.
       * `null` before the stage container exists.
       */
      imagePxToClient: (x: number, y: number) => { x: number; y: number } | null
      /** Clears every pending notification toast immediately, instead of waiting out its auto-dismiss timer - the toast banner is `fixed`/`z-50` over the stage, so a script clicking much faster than a real user risks a click landing on a still-visible toast instead of the canvas underneath it. */
      dismissAllNotifications: () => void
      /** Ids of every hub whose own PLAIN trunk route line (`HubTrunkRouteLines`, not the editor's) is currently mounted on the live stage - lets an e2e spec confirm a route stays visible while its owner hub is selected in a tool other than trunk/select (H2), independent of pixel colours. */
      getTrunkRouteLineHubIds: () => string[]
      /** Ids of every cable whose leg beyond a shaft (`ShaftLegRouteLines`) is currently mounted on the live stage - a leg is drawn on its exit floor, not on its cable's own floor. */
      getShaftLegLineCableIds: () => string[]
      /** Number of Konva Layers on the live interactive stage - confirms a tool mode never grows a sixth. */
      getLayerCount: () => number
      /** Phase 6: the project's `shafts[]` (identity + name, project order - `T{n}` label order). */
      getShafts: () => Array<{ id: string; name: string }>
      /**
       * Phase 7 test gap: the EXACT compatibility-warning text that floor's
       * own PNG strip would show (same pipeline `buildExportLegends`/
       * `exportPlanPng` use: the project-wide warnings filtered to this
       * floor's own devices, same as `resolveCompatibilityWarningText`) -
       * lets an e2e spec confirm a floor's strip never names a device on a
       * DIFFERENT floor, without needing to read pixels out of a downloaded
       * PNG. `null` for an unknown floor id or when that floor's strip would
       * show no compatibility line at all.
       */
      getFloorCompatibilityWarningText: (floorId: string) => string | null
    }
  }
}

/** The live interactive stage among `Konva.stages` (a detached export-spike/PNG-render stage never lands inside the real container). `undefined` before the stage mounts. */
function findInteractiveStage(): Konva.Stage | undefined {
  const container = document.querySelector('[data-testid="stage-container"]')
  if (!container) return undefined
  return Konva.stages.find((stage) => container.contains(stage.container()))
}

/** The part after `prefix` of the name of every Konva Line on the live stage whose name starts with it. */
function findStageLineNameSuffixes(prefix: string): string[] {
  const stage = findInteractiveStage()
  if (!stage) return []
  return stage
    .find('Line')
    .map((node) => node.name())
    .filter((name) => name.startsWith(prefix))
    .map((name) => name.slice(prefix.length))
}

/** Installs `window.__cameraLayoutToolTestHooks` in dev builds only. Call once from `main.tsx`/`app.tsx`. */
export function installDevTestHooks(): void {
  if (!import.meta.env.DEV) return

  window.__cameraLayoutToolTestHooks = {
    getViewport: () => useEditorUiStore.getState().viewport,
    getScale: () => getActiveFloor(useProjectStore.getState()).scale,
    getCameras: () => getActiveFloor(useProjectStore.getState()).cameras,
    getWalls: () => getActiveFloor(useProjectStore.getState()).walls,
    getSensors: () => getActiveFloor(useProjectStore.getState()).sensors,
    getHubs: () => getActiveFloor(useProjectStore.getState()).hubs,
    getCables: () => getActiveFloor(useProjectStore.getState()).cables,
    getFireAlarmDevices: () => getActiveFloor(useProjectStore.getState()).fireAlarmDevices,
    getSelectedCameraId: () => useEditorUiStore.getState().selectedCameraId,
    getSelectedHubId: () => useEditorUiStore.getState().selectedHubId,
    getFloors: () => useProjectStore.getState().floors,
    getActiveFloorId: () => useProjectStore.getState().activeFloorId,
    seedFloor: (name) => {
      useProjectStore.getState().addFloor(name)
      return useProjectStore.getState().activeFloorId // addFloor always activates the floor it just added
    },
    getDecodedImageInfo: () => {
      const decodedImage = useEditorUiStore.getState().decodedImage
      return decodedImage ? { widthPx: decodedImage.naturalWidth, heightPx: decodedImage.naturalHeight } : null
    },
    pushNotification: (kind, message) => useEditorUiStore.getState().pushNotification(kind, message),
    setScale: (scale) => useProjectStore.getState().setScale(scale),
    seedCamera: (camera) => useProjectStore.getState().addCamera({ id: crypto.randomUUID(), ...camera }),
    seedWall: (wall) => useProjectStore.getState().addWall({ id: crypto.randomUUID(), ...wall }),
    // Cast needed: spreading a discriminated union inside an object literal loses the
    // discriminant for TS's inference (unlike seedCamera/seedWall, whose types aren't unions);
    // the shape is still correct at runtime - the caller's `sensor` already matches one member.
    seedSensor: (sensor) => useProjectStore.getState().addSensor({ id: crypto.randomUUID(), ...sensor } as PlacedSensor),
    seedHub: (hub) => useProjectStore.getState().addHub({ id: crypto.randomUUID(), ...hub }),
    seedCable: (cable) => useProjectStore.getState().addCable({ id: crypto.randomUUID(), ...cable }),
    seedFireAlarmDevice: (device) => useProjectStore.getState().addFireAlarmDevice({ id: crypto.randomUUID(), ...device }),
    setFireAlarmSettings: (patch) => useProjectStore.getState().setFireAlarmSettings(patch),
    runExportSpike,
    selectHub: (id) => useEditorUiStore.getState().setSelectedHubId(id),
    selectCable: (id) => useEditorUiStore.getState().setSelectedCableId(id),
    setHubTrunk: (ref, trunk) => useProjectStore.getState().setHubTrunk(ref, trunk),
    imagePxToClient: (x, y) => {
      const container = document.querySelector('[data-testid="stage-container"]')
      if (!container) return null
      const rect = container.getBoundingClientRect()
      const { x: viewportX, y: viewportY, scale } = useEditorUiStore.getState().viewport
      return { x: rect.left + viewportX + x * scale, y: rect.top + viewportY + y * scale }
    },
    dismissAllNotifications: () => {
      const { notifications, dismissNotification } = useEditorUiStore.getState()
      notifications.forEach((n) => dismissNotification(n.id))
    },
    getTrunkRouteLineHubIds: () => findStageLineNameSuffixes('trunk-route-'),
    getShaftLegLineCableIds: () => findStageLineNameSuffixes('shaft-leg-'),
    getLayerCount: () => findInteractiveStage()?.getLayers().length ?? 0,
    getShafts: () => useProjectStore.getState().shafts,
    getFloorCompatibilityWarningText: (floorId) => {
      const store = useProjectStore.getState()
      const floor = store.floors.find((candidate) => candidate.id === floorId)
      if (!floor) return null
      const { fireAlarmWarnings } = buildCombinedBomRows(selectProject(store), { floorId })
      const deviceIds = new Set(floor.fireAlarmDevices.map((device) => device.id))
      return resolveCompatibilityWarningText(floor.fireAlarmDevices, filterCompatibilityWarningsToDeviceIds(fireAlarmWarnings, deviceIds), fireAlarmModelSpecById)
    },
  }
}
