/**
 * Visual constants for hubs and cable routes - sibling to
 * `brand-and-dori-color-palette.ts` and `sensor-kind-color-palette.ts`.
 * Sizes are IMAGE px (plan content, so the PNG export matches the screen).
 * No React/Konva imports - plain data.
 */

/**
 * One line colour per cable type, by the type's index in the project's type
 * list. Dark 800-level hues: a cable is a thin line, so it must read over a
 * light plan, and none repeats a DORI band, brand tint, wall or sensor colour.
 */
export const CABLE_TYPE_COLORS: readonly string[] = [
  '#1e40af', // blue-800
  '#be185d', // pink-700
  '#854d0e', // yellow-800
  '#155e75', // cyan-800
  '#6b21a8', // purple-800
  '#3f6212', // lime-800
  '#9a3412', // orange-800
  '#334155', // slate-700
]

/** A cable whose type is gone (should not happen: a type in use cannot be deleted). */
const CABLE_UNKNOWN_TYPE_COLOR = '#6b7280' // grey-500

/** Colour of the cable type at `typeIndex` in the type list; wraps after eight types. */
export function cableTypeColor(typeIndex: number): string {
  if (!Number.isInteger(typeIndex) || typeIndex < 0) return CABLE_UNKNOWN_TYPE_COLOR
  return CABLE_TYPE_COLORS[typeIndex % CABLE_TYPE_COLORS.length]
}

/** A cable whose run exceeds its type's length limit (drawn dashed in this colour). */
export const CABLE_OVER_LIMIT_COLOR = '#dc2626' // red-600

export const HUB_FILL_COLOR = '#0f172a' // slate-900

/** Cable line width in image px, from the icon radius: thinner than a wall, never hairline. */
export function computeCableStrokeWidthPx(iconRadiusPx: number): number {
  return Math.max(1.5, iconRadiusPx * 0.1)
}

/** While drawing a cable, a click this close to a device or hub lands on it. CSS px before dividing by viewport scale. */
export const CABLE_SNAP_TOLERANCE_SCREEN_PX = 10

/**
 * Snap tolerance in image px: the screen-constant distance, but never less
 * than the icon itself (icons are image-px sized, so at a low zoom the icon
 * is the bigger target and a click anywhere on it must count).
 */
export function resolveCableSnapTolerancePx(viewportScale: number, iconRadiusPx: number): number {
  return Math.max(CABLE_SNAP_TOLERANCE_SCREEN_PX / viewportScale, iconRadiusPx)
}
