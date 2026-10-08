import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type Konva from 'konva'
import { Stage } from 'react-konva'
import { PlanSceneLayers } from './canvas/stage/plan-scene-layers'
import { useEditorUiStore } from './state/editor-ui-store'
import { useProjectStore } from './state/project-store'
import { getActiveFloor } from './state/project-store-floor-selectors'

/**
 * Mounts the same `PlanSceneLayers` used on-screen into a detached,
 * non-interactive Stage at image-native size, and rasterises it - lets the
 * PNG export reuse this component with zero drawing-code duplication. Split
 * out of `dev-test-hooks.tsx` to keep that file under the project's
 * line-count guideline.
 *
 * react-konva's Stage ref never attaches on a container that is never
 * inserted into `document` at all (its mount effect appears to depend on
 * being connected). Off-screen-but-attached (never visible, never affects
 * layout) is the workaround.
 */
export function runExportSpike(): Promise<{ dataUrlLength: number; widthPx: number; heightPx: number }> {
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
      createElement(
        Stage,
        {
          ref: (node: Konva.Stage | null) => {
            stageRef.current = node
          },
          width: image.widthPx,
          height: image.heightPx,
        },
        createElement(PlanSceneLayers, {
          decodedImage,
          imageWidthPx: image.widthPx,
          imageHeightPx: image.heightPx,
          cameras,
          walls,
          sensors,
          fireAlarmDevices,
          fireAlarmSettings,
          planPxPerMeter: scale.planPxPerMeter,
          scaleIsSet: true,
          cabling: { hubs, cables, cableTypes, cableSettings, scale },
          interactive: false,
          selectedCameraId: null,
          selectedWallId: null,
          selectedSensorId: null,
          selectedFireAlarmDeviceId: null,
          wallsSelectable: false,
          viewportScale: 1,
          onSelectCamera: () => {},
          onSelectWall: () => {},
          onSelectSensor: () => {},
          onSelectFireAlarmDevice: () => {},
          onMoveWallNode: () => {},
          onCameraDragEnd: () => {},
          onCameraRotateEnd: () => {},
          onSensorCommit: () => {},
          onFireAlarmDeviceCommit: () => {},
        }),
      ),
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
