/**
 * Domain types for non-camera security sensors (PIR motion, active IR beam,
 * shock/acoustic vibration, thermal camera) and the catalog-mirroring shape
 * used to resolve a placed sensor's coverage. Pure data + small pure helpers
 * only - no React/Konva/`src/catalog` imports (same rule as
 * `project-types.ts`; enforced by `no-react-konva-imports.test.ts`).
 *
 * Deviation from the original sketch: based on the datasheet survey, PIR
 * has no "ceiling circle" shape. Every obtainable PIR
 * datasheet prints a single detection sector (range + angle, up to 360deg for
 * a ceiling unit), so `pir.coverage` below is a plain sector - never a
 * height-keyed diameter table. `sensorPlacementShape` reflects that: pir and
 * thermal both draw as the placed `sector` shape (thermal's HFOV becomes the
 * sector angle); vibration draws as the placed `circle` shape; beam as
 * `beam`. A sector whose effective angle is 360 is simply a full circle -
 * `fov-cone-sector-geometry.ts`'s `coneSweepShape` already handles that.
 */

export type SensorKind = 'pir' | 'beam' | 'vibration' | 'thermal'

/** Which of the three placed-sensor shapes a model's catalog kind draws as. */
export type SensorPlacementShape = 'sector' | 'circle' | 'beam'

export const SENSOR_KIND_LABELS: Record<SensorKind, string> = {
  pir: 'PIR motion',
  beam: 'IR beam',
  vibration: 'Vibration / glass-break',
  thermal: 'Thermal camera',
}

/** Fixed display order used everywhere a UI lists all four kinds (the catalog tab filter, the PNG export legend line). */
export const SENSOR_KIND_DISPLAY_ORDER: readonly SensorKind[] = ['pir', 'beam', 'vibration', 'thermal']

/** Below this length, in image px, a beam's two ends count as the same point - too short to mean anything. Shared by the file loader's drop-on-load check (`project-file-sensor-schema.ts`) and the beam node's commit-time refusal (`beam-end-drag-commit.ts`). */
export const MIN_BEAM_LENGTH_PX = 1

interface PlacedSensorBase {
  id: string
  modelId: string
  /** Position in image pixels, x right, y down. For a beam this is the transmitter end. */
  x: number
  y: number
}

/** PIR and thermal sensors: a detection sector drawn like a camera's FOV cone. */
export interface PlacedSectorSensor extends PlacedSensorBase {
  shape: 'sector'
  /** Bearing of the sector's centre line, degrees, 0 = +x, clockwise. */
  rotationDeg: number
  rangeM: number
  /** Override of the catalog angle. Omitted = use the datasheet value. */
  angleDeg?: number
}

/** Vibration/glass-break sensors: an omnidirectional detection radius. */
export interface PlacedCircleSensor extends PlacedSensorBase {
  shape: 'circle'
  radiusM: number
}

/** Active IR photoelectric beam: a transmitter/receiver pair and a straight line between them. */
export interface PlacedBeamSensor extends PlacedSensorBase {
  shape: 'beam'
  /** Receiver position, image px. */
  x2: number
  y2: number
  /**
   * Which of the model's (up to two) printed max distances the over-distance
   * check uses (phase 3's `resolveBeamMaxDistanceM`). Always present in
   * memory; optional in the saved file (see `project-file-sensor-schema.ts`
   * for the load-time default).
   */
  environment: 'indoor' | 'outdoor'
}

export type PlacedSensor = PlacedSectorSensor | PlacedCircleSensor | PlacedBeamSensor

export type PlacedSensorPatch = Partial<Pick<PlacedSectorSensor, 'rotationDeg' | 'rangeM' | 'angleDeg'>> &
  Partial<Pick<PlacedCircleSensor, 'radiusM'>> &
  Partial<Pick<PlacedBeamSensor, 'x2' | 'y2' | 'environment'>> & { x?: number; y?: number }

/** One human/vehicle detection-recognition-identification distance triple, as printed. */
export interface ThermalDriM {
  detect: number
  recognize: number
  identify: number
}

/**
 * Minimal structural shape the domain needs from a catalog sensor model.
 * Mirrors `src/catalog/sensor-catalog-kind-coverage-schemas.ts` +
 * `sensor-catalog-schema.ts` (frozen at Phase 1 gate G1) field-for-field,
 * minus the catalog-only provenance fields (`id`, `sourceUrl`, ...) this
 * domain layer never reads. See
 * `src/catalog/sensor-model-spec-assignability.test.ts` for the compile-time
 * proof the two never drift apart. Defined locally (not imported from
 * `src/catalog`) so real catalog records - which carry those extra fields -
 * satisfy this type by plain structural typing.
 */
export type SensorModelSpec = { brand: string; model: string; priceVn?: { amountVnd: number } | null } & (
  | { kind: 'pir'; coverage: { rangeM: number; angleDeg: number; vfovDeg?: number } }
  | { kind: 'beam'; maxDistanceOutdoorM: number | null; maxDistanceIndoorM: number | null }
  | { kind: 'vibration'; detection: string; radii: { surface: string | null; radiusM: number }[] }
  | {
      kind: 'thermal'
      pixelWidth: number
      pixelHeight: number
      focalMm: number
      hfovDeg: number
      vfovDeg?: number
      detectionRangeM: { human: ThermalDriM; vehicle: ThermalDriM | null }
    }
)

export type BeamModelSpec = Extract<SensorModelSpec, { kind: 'beam' }>

/**
 * The datasheet's own printed vertical FOV - pir's `coverage.vfovDeg` or
 * thermal's `vfovDeg`; undefined when the datasheet prints none, and never
 * computed (CLAUDE.md: VFOV is optional, stored only as printed). Shared by
 * the catalog card and the properties panel's read-only summary (both used
 * to redefine this identically).
 */
export function printedVfovDeg(spec: SensorModelSpec): number | undefined {
  if (spec.kind === 'pir') return spec.coverage.vfovDeg
  if (spec.kind === 'thermal') return spec.vfovDeg
  return undefined
}

/** Which placed shape a model's catalog kind draws as. */
export function sensorPlacementShape(spec: SensorModelSpec): SensorPlacementShape {
  switch (spec.kind) {
    case 'pir':
    case 'thermal':
      return 'sector'
    case 'vibration':
      return 'circle'
    case 'beam':
      return 'beam'
  }
}

/**
 * The environment whose printed max distance is smaller; when the model
 * prints only one figure, that figure's environment (plan Validation
 * Session 1). Used as the default for a beam sensor's `environment`, both
 * on drop (phase 3's `buildPlacedSensorAtDrop`) and when a loaded project
 * file omits it (`project-file-sensor-schema.ts`'s `normaliseLoadedSensors`).
 * The catalog schema guarantees at least one figure is non-null.
 */
export function defaultBeamEnvironment(spec: BeamModelSpec): 'indoor' | 'outdoor' {
  const { maxDistanceIndoorM, maxDistanceOutdoorM } = spec
  if (maxDistanceOutdoorM === null) return 'indoor'
  if (maxDistanceIndoorM === null) return 'outdoor'
  return maxDistanceIndoorM <= maxDistanceOutdoorM ? 'indoor' : 'outdoor'
}

// `applyPlacedSensorPatch` (the patch-applying helper built on these types) lives in
// `placed-sensor-patch.ts` - split out to keep this file under the project's line-count
// guideline.
