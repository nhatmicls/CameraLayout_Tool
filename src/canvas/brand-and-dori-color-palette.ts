/**
 * Visual constants for the canvas layer: brand tint (icon fill) and DORI
 * band colours are two deliberately separate palettes (different hue
 * families) so they never read as "the same code" to a user glancing at the
 * plan. No React/Konva imports - plain data, but lives in `src/canvas/`
 * (not `src/domain/`) since it is a rendering concern, not geometry/DORI
 * math.
 */
import type { Brand } from '../catalog/camera-catalog-schema'
import type { DoriBandZone } from '../domain/camera-coverage-resolver'

/** Icon fill colour per brand - a quick-glance cue only; brand name itself is always shown as text (no logos). */
export const BRAND_TINTS: Record<Brand, string> = {
  hikvision: '#b91c1c', // red-700
  dahua: '#7c3aed', // violet-600
  axis: '#0e7490', // cyan-700
}

/**
 * Fill/stroke colour per DORI zone, ordered "best assurance nearest the
 * camera" (green) to "worst, past detect" (grey). Checked for readable
 * contrast at ~0.25 fill opacity over a white/light plan background.
 */
export const DORI_BAND_COLORS: Record<DoriBandZone, string> = {
  identify: '#15803d', // green-700
  recognize: '#65a30d', // lime-600
  observe: '#ca8a04', // amber-600
  detect: '#ea580c', // orange-600
  'beyond-detect': '#9ca3af', // neutral grey-400
}

/** Fill opacity for a DORI band; doubled-ish for the selected camera's cone so it reads clearly over any overlapping neighbours. */
export const DORI_BAND_FILL_OPACITY = 0.25
export const DORI_BAND_FILL_OPACITY_SELECTED = 0.4

/** Wall line colours, shared by the canvas and the legend. Selected overrides either kind. */
export const WALL_OPAQUE_COLOR = '#111827' // gray-900
export const WALL_GLASS_COLOR = '#0ea5e9' // sky-500
export const WALL_SELECTED_COLOR = '#2563eb' // blue-600

/** Wall line width in *image* pixels (plan content, like the marker icon), from the icon radius. */
export function computeWallStrokeWidthPx(iconRadiusPx: number): number {
  return Math.max(2, iconRadiusPx * 0.15)
}

/**
 * Marker icon radius, in *image* pixels - it must stay legible in a
 * native-resolution PNG export (phase 7), so it is never divided by the
 * viewport's zoom scale (unlike the selection ring / rotation handle, which
 * are screen-constant and excluded from export). Tuned once against a
 * 1200px-long-edge image (floor at 12px) and a 6000px one (40px).
 */
export function computeIconRadiusPx(longEdgePx: number): number {
  const MIN_ICON_RADIUS_PX = 12
  const ICON_RADIUS_DIVISOR = 150
  return Math.max(MIN_ICON_RADIUS_PX, longEdgePx / ICON_RADIUS_DIVISOR)
}

/** Screen-constant rotation-handle distance from the camera centre, in CSS px before dividing by viewport scale. */
export const ROTATION_HANDLE_DISTANCE_PX = 40
/** Screen-constant rotation-handle radius, in CSS px before dividing by viewport scale. */
export const ROTATION_HANDLE_RADIUS_PX = 5
/** Screen-constant selection-ring padding beyond the icon radius, in CSS px before dividing by viewport scale. */
export const SELECTION_RING_PADDING_PX = 4
/** While drawing walls, a point this close to a wall endpoint snaps onto it. CSS px before dividing by viewport scale. */
export const WALL_SNAP_TOLERANCE_SCREEN_PX = 10
