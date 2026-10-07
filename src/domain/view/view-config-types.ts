/**
 * The view config: which kinds of items are DRAWN on the plan. UI-only state
 * (lives in `editor-ui-store.ts`): never persisted to the project file, never
 * in undo history, never sets `hasUnsavedChanges`. Hiding is purely visual -
 * the BOM, the CSV, the cable estimate and wall occlusion always use the
 * full project. Pure data + small pure helpers, no React/Konva/`src/catalog`
 * imports (enforced by `no-react-konva-imports.test.ts`).
 */
import type { SensorKind } from '../sensor/sensor-types'

/**
 * The camera form factors a view toggle exists for. Declared here, not
 * imported, because `src/domain` must not import `src/catalog`;
 * `src/catalog/camera/view-config-form-factor-keys-match-catalog.test.ts`
 * proves this list and the catalog's `FORM_FACTORS` hold the same values.
 */
export const VIEW_CAMERA_FORM_FACTORS = ['bullet', 'dome', 'turret', 'ptz', 'fisheye'] as const
export type ViewCameraFormFactor = (typeof VIEW_CAMERA_FORM_FACTORS)[number]

export interface ViewConfig {
  /** Master switch for every camera marker. */
  cameraMarkers: boolean
  /** Master switch for every camera FOV cone. */
  cameraCones: boolean
  /** Per form factor: off hides both the marker and the cone of those cameras. */
  cameraFormFactors: Record<ViewCameraFormFactor, boolean>
  /** Master switch for every sensor marker - a whole IR beam (line + both ends) counts as a marker. */
  sensorMarkers: boolean
  /** Master switch for every sensor coverage shape (PIR sector, vibration circle, thermal cone). */
  sensorCoverage: boolean
  /** Per kind: off hides both the marker and the coverage of those sensors. */
  sensorKinds: Record<SensorKind, boolean>
  /** Hubs, risers and drops. */
  hubs: boolean
  cables: boolean
  /** Wall lines and node handles only - hidden walls still block cones, coverage and beams. */
  walls: boolean
}

/** Everything visible. Frozen (nested records too): every change goes through `withViewToggle` / `reveal*`, which return a new object. */
export const DEFAULT_VIEW_CONFIG: ViewConfig = Object.freeze({
  cameraMarkers: true,
  cameraCones: true,
  cameraFormFactors: Object.freeze({ bullet: true, dome: true, turret: true, ptz: true, fisheye: true }),
  sensorMarkers: true,
  sensorCoverage: true,
  sensorKinds: Object.freeze({ pir: true, beam: true, vibration: true, thermal: true }),
  hubs: true,
  cables: true,
  walls: true,
})

export function isViewCameraFormFactor(value: string | undefined): value is ViewCameraFormFactor {
  return value !== undefined && (VIEW_CAMERA_FORM_FACTORS as readonly string[]).includes(value)
}

/**
 * Makes cameras of `formFactor` visible as markers (master + that form
 * factor); `cameraCones` is left alone. Returns the SAME object when nothing
 * changes, so a caller can compare by identity. An unknown form factor has
 * no toggle and is never hidden, so it changes nothing.
 */
export function revealCameraFormFactorInView(config: ViewConfig, formFactor: string | undefined): ViewConfig {
  if (!isViewCameraFormFactor(formFactor)) return config
  if (config.cameraMarkers && config.cameraFormFactors[formFactor]) return config
  return { ...config, cameraMarkers: true, cameraFormFactors: { ...config.cameraFormFactors, [formFactor]: true } }
}

/** Sensor twin of `revealCameraFormFactorInView`: master markers + that kind on, `sensorCoverage` left alone. */
export function revealSensorKindInView(config: ViewConfig, kind: SensorKind | undefined): ViewConfig {
  if (kind === undefined) return config
  if (config.sensorMarkers && config.sensorKinds[kind]) return config
  return { ...config, sensorMarkers: true, sensorKinds: { ...config.sensorKinds, [kind]: true } }
}
