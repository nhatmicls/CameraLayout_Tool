/**
 * Which placed cameras / sensors a view config hides, as ID SETS. Never
 * filter the `cameras` / `sensors` arrays instead: labels `C{n}` / `S{n}`
 * come from the array index (hiding C2 must leave C1 and C3 named as they
 * are) and cable ends are resolved from the full arrays.
 *
 * Placed items carry only a `modelId`, and the domain cannot import the
 * catalog, so the form factor / kind comes through a lookup callback. An
 * unknown model id (lookup returns undefined) is never put in a hidden set.
 */
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor, SensorKind } from '../sensor/sensor-types'
import { isViewCameraFormFactor, type ViewConfig } from './view-config-types'

export interface HiddenIdSets {
  /** Ids whose marker is not drawn (for a beam: the whole beam, line + both ends). */
  markers: ReadonlySet<string>
  /** Ids whose FOV cone / coverage shape is not drawn. */
  coverage: ReadonlySet<string>
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>()

/** Shared "nothing hidden" result: an all-visible config always returns this exact object, so memoised consumers do not re-render. */
export const NO_HIDDEN_IDS: HiddenIdSets = Object.freeze({ markers: EMPTY_ID_SET, coverage: EMPTY_ID_SET })

/** `coverage` = the FOV cones. A form factor that is off hides both the marker and the cone. */
export function computeHiddenCameraIds(
  cameras: readonly PlacedCamera[],
  config: ViewConfig,
  formFactorOf: (modelId: string) => string | undefined,
): HiddenIdSets {
  const everyFormFactorOn = Object.values(config.cameraFormFactors).every(Boolean)
  if (config.cameraMarkers && config.cameraCones && everyFormFactorOn) return NO_HIDDEN_IDS

  const markers = new Set<string>()
  const coverage = new Set<string>()
  for (const camera of cameras) {
    const formFactor = formFactorOf(camera.modelId)
    if (!isViewCameraFormFactor(formFactor)) continue
    const formFactorOn = config.cameraFormFactors[formFactor]
    if (!config.cameraMarkers || !formFactorOn) markers.add(camera.id)
    if (!config.cameraCones || !formFactorOn) coverage.add(camera.id)
  }
  return { markers, coverage }
}

/**
 * A kind that is off hides both the marker and the coverage. A beam has no
 * coverage shape (it is never in `coverage`); its line is part of its marker.
 * A thermal cone is coverage, like a PIR sector.
 */
export function computeHiddenSensorIds(
  sensors: readonly PlacedSensor[],
  config: ViewConfig,
  sensorKindOf: (modelId: string) => SensorKind | undefined,
): HiddenIdSets {
  const everyKindOn = Object.values(config.sensorKinds).every(Boolean)
  if (config.sensorMarkers && config.sensorCoverage && everyKindOn) return NO_HIDDEN_IDS

  const markers = new Set<string>()
  const coverage = new Set<string>()
  for (const sensor of sensors) {
    const kind = sensorKindOf(sensor.modelId)
    if (kind === undefined) continue
    const kindOn = config.sensorKinds[kind]
    if (!config.sensorMarkers || !kindOn) markers.add(sensor.id)
    if (sensor.shape !== 'beam' && (!config.sensorCoverage || !kindOn)) coverage.add(sensor.id)
  }
  return { markers, coverage }
}
