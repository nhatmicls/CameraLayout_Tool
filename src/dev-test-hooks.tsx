import { createRoot } from 'react-dom/client'
import type Konva from 'konva'
import { Stage } from 'react-konva'
import { useProjectStore } from './state/project-store'
import { getActiveFloor } from './state/project-store-floor-selectors'
import { useEditorUiStore, type UiNotification, type Viewport } from './state/editor-ui-store'
import { PlanSceneLayers } from './canvas/stage/plan-scene-layers'
import type { Cable, Hub } from './domain/cable/cable-layout-types'
import type { PlacedCamera, ScaleCalibration, Wall } from './domain/project-file/project-types'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from './domain/fire-alarm/fire-alarm-device-types'
import type { PlacedSensor } from './domain/sensor/sensor-types'

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
    }
  }
}

/**
 * Mounts the same `PlanSceneLayers` used on-screen into a detached,
 * non-interactive Stage at image-native size, and rasterises it - lets the
 * PNG export reuse this component with zero drawing-code duplication.
 *
 * react-konva's Stage ref never attaches on a container that is never
 * inserted into `document` at all (its mount effect appears to depend on
 * being connected). Off-screen-but-attached (never visible, never affects
 * layout) is the workaround.
 */
function runExportSpike(): Promise<{ dataUrlLength: number; widthPx: number; heightPx: number }> {
  return new Promise((resolve, reject) => {
    const store = useProjectStore.getState()
    const { image, scale, cameras, walls, sensors, hubs, cables, fireAlarmDevices } = getActiveFloor(store)
    const { cableTypes, cableSettings, fireAlarmSettings } = store
    const decodedImage = useEditorUiStore.getState().decodedImage
    if (!image || !scale || !decodedImage) {
      reject(new Error('runExportSpike: no calibrated project to export'))
      return
    }

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed; left:-99999px; top:-99999px;'
    document.body.appendChild(container)
    const root = createRoot(container)
    const stageRef = { current: null as Konva.Stage | null }

    root.render(
      <Stage
        ref={(node) => {
          stageRef.current = node
        }}
        width={image.widthPx}
        height={image.heightPx}
      >
        <PlanSceneLayers
          decodedImage={decodedImage}
          imageWidthPx={image.widthPx}
          imageHeightPx={image.heightPx}
          cameras={cameras}
          walls={walls}
          sensors={sensors}
          fireAlarmDevices={fireAlarmDevices}
          fireAlarmSettings={fireAlarmSettings}
          planPxPerMeter={scale.planPxPerMeter}
          scaleIsSet
          cabling={{ hubs, cables, cableTypes, cableSettings, scale }}
          interactive={false}
          selectedCameraId={null}
          selectedWallId={null}
          selectedSensorId={null}
          selectedFireAlarmDeviceId={null}
          wallsSelectable={false}
          viewportScale={1}
          onSelectCamera={() => {}}
          onSelectWall={() => {}}
          onSelectSensor={() => {}}
          onSelectFireAlarmDevice={() => {}}
          onMoveWallNode={() => {}}
          onCameraDragEnd={() => {}}
          onCameraRotateEnd={() => {}}
          onSensorCommit={() => {}}
          onFireAlarmDeviceCommit={() => {}}
        />
      </Stage>,
    )

    // React's commit (and so the ref callback firing) isn't guaranteed to
    // land within a single requestAnimationFrame - poll a few frames rather
    // than assume one is enough (observed flaky with just one on a large,
    // 40-camera scene).
    let attemptsLeft = 10
    const tryCapture = () => {
      const stage = stageRef.current
      if (!stage) {
        attemptsLeft -= 1
        if (attemptsLeft <= 0) {
          root.unmount()
          container.remove()
          reject(new Error('runExportSpike: detached Stage ref never attached after 10 frames'))
          return
        }
        requestAnimationFrame(tryCapture)
        return
      }
      try {
        const dataUrl = stage.toDataURL({ pixelRatio: 1 })
        resolve({ dataUrlLength: dataUrl.length, widthPx: image.widthPx, heightPx: image.heightPx })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      } finally {
        root.unmount()
        container.remove()
      }
    }
    requestAnimationFrame(tryCapture)
  })
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
  }
}
