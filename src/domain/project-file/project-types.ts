/**
 * Core domain types for a saved project: the floor-plan image, its scale
 * calibration, the placed cameras and the drawn walls. Pure data shapes only - no behaviour,
 * no React/Konva imports.
 *
 * Schema v7 made the project multi-floor (`Project.floors`, see `Floor` in
 * `domain/floor/floor-types.ts`); `LegacyFlatProject` below is the pre-v7
 * flat shape (one floor's worth of data at the top level) the legacy reader
 * still produces, now used only by `project-file-legacy-flat-migration.ts`
 * (the store itself holds `floors[]` directly since phase 2).
 */
import type { CableLayout, CableSettings, CableType, Shaft } from '../cable/cable-layout-types'
import type { Floor } from '../floor/floor-types'
import { DEFAULT_FIRE_ALARM_SETTINGS, type FireAlarmSettings, type PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { PlacedSensor } from '../sensor/sensor-types'

/** A camera placed on the floor plan. Position/rotation live in image pixel space (y-down, matching canvas + Konva). */
export interface PlacedCamera {
  id: string
  modelId: string
  /** Position in image pixels, x right, y down. */
  x: number
  y: number
  /** Bearing of the optical axis in degrees, 0 = +x, clockwise positive (canvas y-down == Konva rotation convention). */
  rotationDeg: number
  /** Overrides the catalog HFOV (e.g. user-adjusted varifocal zoom). Degrees, (0, 360]. Omitted = use catalog default. */
  hfovDeg?: number
  /** Coverage range drawn on the canvas, metres. */
  rangeM: number
  /** Lens height above the floor, metres [0.5, 30]. Omitted = legacy flat cone (no height model). */
  mountHeightM?: number
  /** Downward tilt of the optical axis from horizontal, degrees [0, 90]. Set together with mountHeightM. */
  tiltDeg?: number
}

export interface ScaleCalibrationRefLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ScaleCalibration {
  /** Plan image pixels per metre, derived from the calibration line. Distinct from `DORI_PX_PER_METER` - never mix the two. */
  planPxPerMeter: number
  refLine: ScaleCalibrationRefLine
  refLengthM: number
}

export interface PlanImage {
  /** `data:image/(png|jpeg);base64,...` URL. Validated by `project-file-schema.ts` whenever it crosses a trust boundary. */
  dataUrl: string
  widthPx: number
  heightPx: number
  fileName: string
}

export type WallKind = 'opaque' | 'glass'

/** One straight wall segment in image px. Opaque blocks camera view; glass is reference only. */
export interface Wall {
  id: string
  kind: WallKind
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * The two fire-alarm fields, always present in memory; optional in the file
 * (pre-v6 files have neither). Combinator mirrors `CableLayout`
 * (`cable-layout-types.ts`). Used by the pre-v7 flat shape (`LegacyFlatProject`)
 * and by the store's fire-alarm action slice (`FireAlarmState`, routed onto
 * the active floor's `fireAlarmDevices` + the project-level `fireAlarmSettings`
 * - see `project-store.ts`'s `routeFireAlarmPartial`); v7's `Project` itself
 * keeps `fireAlarmSettings` at project level and moves `fireAlarmDevices`
 * onto each `Floor` instead.
 */
export interface FireAlarmLayout {
  fireAlarmDevices: PlacedFireAlarmDevice[]
  fireAlarmSettings: FireAlarmSettings
}

/** Fresh empty state for a new/reset project - a defensive clone of `DEFAULT_FIRE_ALARM_SETTINGS` so no two callers ever share one mutable reference (mirrors `createEmptyCableLayout`'s `{ ...DEFAULT_CABLE_SETTINGS }`). */
export function createEmptyFireAlarmLayout(): FireAlarmLayout {
  return { fireAlarmDevices: [], fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS } }
}

/**
 * Pre-v7 flat shape: one floor's worth of data at the top level. The cable
 * and fire-alarm fields are always present in memory; optional in the file
 * (v1-v4 files have no cable keys, v1-v5 have no fire-alarm keys). Used only
 * by the legacy (v1-v6) reader today (`project-file-legacy-flat-migration.ts`
 * wraps it into one `Floor`) - phase 1 also had the still-flat store use it
 * as a save/load bridge type; phase 2 removed that bridge.
 */
export interface LegacyFlatProject extends CableLayout, FireAlarmLayout {
  image: PlanImage
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
  /** Always present in memory; optional in the file (older files have none). */
  walls: Wall[]
  /** Always present in memory; optional in the file (v1-v3 files have none). See `sensor-types.ts`. */
  sensors: PlacedSensor[]
}

/**
 * Multi-floor project (schema v7). `floors[0]` is the lowest floor (tab
 * order). `shafts` is the project-wide list of vertical tubes (phase 1:
 * names only, no markers yet). `fireAlarmSettings` stays project-level - one
 * coverage-mode setting for the whole building - while each floor's own
 * `fireAlarmDevices` lives on `Floor` (see its doc comment).
 */
export interface Project {
  floors: Floor[]
  shafts: Shaft[]
  cableTypes: CableType[]
  cableSettings: CableSettings
  fireAlarmSettings: FireAlarmSettings
}

/**
 * Minimal structural shape the domain needs from a catalog camera model.
 * Mirrors `src/catalog/camera/camera-catalog-schema.ts` (Phase 2, built concurrently
 * with this phase - see phase-02 "Architecture" section for the full record).
 * Defined locally on purpose: the plan's Key Insights say project/domain
 * modules must stay independent of `src/catalog`. TypeScript structural
 * typing means the real catalog records (with their extra fields such as
 * `id`, `sourceUrl`, `notes`) satisfy this type without any adapter.
 */
export type CameraLensSpec =
  | {
      kind: 'fixed'
      focalMm: number
      hfovDeg: number
      /** Datasheet vertical FOV, degrees. Omitted = not printed (derived at runtime). */
      vfovDeg?: number
    }
  | {
      kind: 'varifocal'
      focalMinMm: number
      focalMaxMm: number
      hfovWideDeg: number
      hfovTeleDeg: number
      /** Datasheet vertical FOV at the wide / tele end, degrees. Both present or both omitted. */
      vfovWideDeg?: number
      vfovTeleDeg?: number
    }

export interface CameraModelSpec {
  brand: string
  model: string
  formFactor: string
  pixelWidth: number
  pixelHeight: number
  resolutionMp: number
  lens: CameraLensSpec
  /** Datasheet illumination/IR range in metres, or null when not published. */
  illuminationRangeM: number | null
  /** Indicative Vietnam reseller price (VND), or null/omitted when no price is published. */
  priceVn?: { amountVnd: number } | null
}
