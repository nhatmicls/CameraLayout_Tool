/**
 * Core domain types for a saved project: the floor-plan image, its scale
 * calibration, the placed cameras and the drawn walls. Pure data shapes only - no behaviour,
 * no React/Konva imports.
 *
 * Schema v7 made the project multi-floor (`Project.floors`, see `Floor` in
 * `domain/floor/floor-types.ts`); the pre-v7 flat shape (one floor's worth
 * of data at the top level) is read directly off the legacy zod schema
 * instead (`LegacyFlatProjectFileData`/`WrappedLegacyFlatProject` in
 * `project-file-legacy-flat-migration.ts`) - the store itself holds
 * `floors[]` directly, with no separate flat save/load bridge type.
 */
import type { CableSettings, CableType, Shaft } from '../cable/cable-layout-types'
import type { Floor } from '../floor/floor-types'
import type { FireAlarmSettings, PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'

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
 * (`cable-layout-types.ts`). Used by the store's fire-alarm action slice
 * (`FireAlarmState`, routed onto the active floor's `fireAlarmDevices` +
 * the project-level `fireAlarmSettings` - see `project-store.ts`'s
 * `routeFireAlarmPartial`); v7's `Project` itself keeps `fireAlarmSettings`
 * at project level and moves `fireAlarmDevices` onto each `Floor` instead.
 */
export interface FireAlarmLayout {
  fireAlarmDevices: PlacedFireAlarmDevice[]
  fireAlarmSettings: FireAlarmSettings
}

/**
 * Multi-floor project (schema v7). `floors[0]` is the lowest floor (tab
 * order). `shafts` is the project-wide list of vertical tubes; each one's
 * own openings are hub markers on the floors it passes through
 * (`Hub.kind: 'shaft'`, `Hub.shaftId`), not stored here. `fireAlarmSettings`
 * stays project-level - one coverage-mode setting for the whole building -
 * while each floor's own `fireAlarmDevices` lives on `Floor` (see its doc
 * comment).
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
 * Mirrors `src/catalog/camera/camera-catalog-schema.ts`. Defined locally on
 * purpose: `src/domain/**` must stay independent of `src/catalog`.
 * TypeScript structural typing means the real catalog records (with their
 * extra fields such as `id`, `sourceUrl`, `notes`) satisfy this type
 * without any adapter.
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
