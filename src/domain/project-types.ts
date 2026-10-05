/**
 * Core domain types for a saved project: the floor-plan image, its scale
 * calibration, and the placed cameras. Pure data shapes only - no behaviour,
 * no React/Konva imports. Phase 4 builds the zustand store on top of these.
 */

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

export interface Project {
  image: PlanImage
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
}

/**
 * Minimal structural shape the domain needs from a catalog camera model.
 * Mirrors `src/catalog/camera-catalog-schema.ts` (Phase 2, built concurrently
 * with this phase - see phase-02 "Architecture" section for the full record).
 * Defined locally on purpose: the plan's Key Insights say project/domain
 * modules must stay independent of `src/catalog`. TypeScript structural
 * typing means the real catalog records (with their extra fields such as
 * `id`, `sourceUrl`, `notes`) satisfy this type without any adapter.
 */
export type CameraLensSpec =
  | { kind: 'fixed'; focalMm: number; hfovDeg: number }
  | {
      kind: 'varifocal'
      focalMinMm: number
      focalMaxMm: number
      hfovWideDeg: number
      hfovTeleDeg: number
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
