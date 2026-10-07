import { useMemo } from 'react'
import { cameraFormFactorOf } from '../../catalog/camera/camera-catalog-loader'
import { sensorKindOf } from '../../catalog/sensor/sensor-catalog-loader'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { computeHiddenCameraIds, computeHiddenSensorIds, type HiddenIdSets } from '../../domain/view/plan-view-visibility'
import type { ViewConfig } from '../../domain/view/view-config-types'

/**
 * The ids `PlanSceneLayers` must skip for a view config: one set pair for
 * cameras, one for sensors. Two memos, so moving a camera never rebuilds the
 * sensor sets (and the reverse). An all-visible config returns the shared
 * `NO_HIDDEN_IDS`, so the default scene does no extra work.
 */
export function usePlanSceneViewVisibility(
  cameras: PlacedCamera[],
  sensors: PlacedSensor[],
  viewConfig: ViewConfig,
): { cameraHidden: HiddenIdSets; sensorHidden: HiddenIdSets } {
  const cameraHidden = useMemo(() => computeHiddenCameraIds(cameras, viewConfig, cameraFormFactorOf), [cameras, viewConfig])
  const sensorHidden = useMemo(() => computeHiddenSensorIds(sensors, viewConfig, sensorKindOf), [sensors, viewConfig])
  return { cameraHidden, sensorHidden }
}
