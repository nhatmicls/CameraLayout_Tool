/**
 * Visual constants for sensor markers and coverage bands - sibling to
 * `brand-and-dori-color-palette.ts`, kept in its own file so the camera and
 * sensor palettes stay independently reviewable. Hues are chosen away from
 * the DORI family (green -> orange) so a thermal cone's Detect/Recognize/
 * Identify bands never read as DORI bands at a glance. No React/Konva
 * imports - plain data, lives in `src/canvas/` like its sibling (a
 * rendering concern, not domain geometry).
 */
import type { SensorKind } from '../domain/sensor-types'
import type { ThermalDriZone } from '../domain/thermal-dri-band-calculator'

/** Marker/coverage tint per sensor kind that draws a single-colour shape (sector or circle). Thermal is banded separately - see `THERMAL_DRI_BAND_COLORS`. */
export const SENSOR_KIND_COLORS: Record<Exclude<SensorKind, 'thermal'>, string> = {
  pir: '#0d9488', // teal-600
  beam: '#e11d48', // rose-600
  vibration: '#4f46e5', // indigo-600
}

/** Fill/stroke colour per thermal D/R/I zone, nearest (identify) to farthest (detect) - a fuchsia family, distinct from DORI's green-to-orange. */
export const THERMAL_DRI_BAND_COLORS: Record<ThermalDriZone, string> = {
  identify: '#86198f', // fuchsia-800
  recognize: '#c026d3', // fuchsia-600
  detect: '#e879f9', // fuchsia-400
}

/** Marker tint for every sensor kind, including thermal (uses its nearest/identify band colour so the marker reads as part of its own cone). */
export const SENSOR_MARKER_TINT: Record<SensorKind, string> = {
  ...SENSOR_KIND_COLORS,
  thermal: THERMAL_DRI_BAND_COLORS.identify,
}

/** Beam line colour while its line-of-sight is blocked by an opaque wall. */
export const BEAM_BLOCKED_COLOR = '#6b7280' // neutral grey-500
/** Beam line colour while its length exceeds the model's printed max distance for its chosen environment. */
export const BEAM_OVER_DISTANCE_COLOR = '#d97706' // amber-600
