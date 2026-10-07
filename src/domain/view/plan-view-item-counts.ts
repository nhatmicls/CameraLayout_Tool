/**
 * How many placed items each view toggle governs - the live "(n)" shown
 * next to every row of the View panel. Counts the whole project, never the
 * visible part: a hidden item still counts.
 */
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor, SensorKind } from '../sensor/sensor-types'
import { isViewCameraFormFactor, type ViewCameraFormFactor } from './view-config-types'
import type { ViewToggleKey } from './view-config-toggle-table'

export interface PlanViewItemCounts {
  /** Every placed camera, including one whose model id is unknown. */
  cameras: number
  cameraFormFactors: Record<ViewCameraFormFactor, number>
  /** Every placed sensor, including one whose model id is unknown. */
  sensors: number
  sensorKinds: Record<SensorKind, number>
  /** Hubs + risers + drops. */
  hubs: number
  cables: number
  walls: number
}

export interface PlanViewItemCountsInput {
  cameras: readonly PlacedCamera[]
  sensors: readonly PlacedSensor[]
  hubs: readonly unknown[]
  cables: readonly unknown[]
  walls: readonly unknown[]
}

/** One pass per array. An unknown model id counts in the total only, never per form factor / kind. */
export function countPlanItemsForView(
  input: PlanViewItemCountsInput,
  formFactorOf: (modelId: string) => string | undefined,
  sensorKindOf: (modelId: string) => SensorKind | undefined,
): PlanViewItemCounts {
  const cameraFormFactors: Record<ViewCameraFormFactor, number> = { bullet: 0, dome: 0, turret: 0, ptz: 0, fisheye: 0 }
  for (const camera of input.cameras) {
    const formFactor = formFactorOf(camera.modelId)
    if (isViewCameraFormFactor(formFactor)) cameraFormFactors[formFactor] += 1
  }
  const sensorKinds: Record<SensorKind, number> = { pir: 0, beam: 0, vibration: 0, thermal: 0 }
  for (const sensor of input.sensors) {
    const kind = sensorKindOf(sensor.modelId)
    if (kind !== undefined) sensorKinds[kind] += 1
  }
  return {
    cameras: input.cameras.length,
    cameraFormFactors,
    sensors: input.sensors.length,
    sensorKinds,
    hubs: input.hubs.length,
    cables: input.cables.length,
    walls: input.walls.length,
  }
}

/** The count shown on one toggle row: a master camera / sensor row shows the total of its group. */
export function viewToggleItemCount(counts: PlanViewItemCounts, key: ViewToggleKey): number {
  if ('formFactor' in key) return counts.cameraFormFactors[key.formFactor]
  if ('sensorKind' in key) return counts.sensorKinds[key.sensorKind]
  switch (key.flag) {
    case 'cameraMarkers':
    case 'cameraCones':
      return counts.cameras
    case 'sensorMarkers':
    case 'sensorCoverage':
      return counts.sensors
    case 'hubs':
      return counts.hubs
    case 'cables':
      return counts.cables
    case 'walls':
      return counts.walls
  }
}
