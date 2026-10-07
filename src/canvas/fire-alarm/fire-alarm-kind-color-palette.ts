/**
 * Marker/coverage tint per fire-alarm kind - sibling to
 * `sensor-kind-color-palette.ts` / `brand-and-dori-color-palette.ts`, kept in
 * its own file so the three palettes stay independently reviewable. Hues
 * stay away from both the DORI family (green -> orange) and the sensor
 * family (teal/indigo/fuchsia/rose) so a fire-alarm marker never reads as
 * either at a glance. No React/Konva imports - plain data.
 */
import type { FireAlarmKind } from '../../domain/fire-alarm/fire-alarm-device-types'

export const FIRE_ALARM_KIND_COLORS: Record<FireAlarmKind, string> = {
  'control-panel': '#1e293b', // slate-800 - the system's own cabinet
  'wireless-hub': '#334155', // slate-700
  'expander-module': '#475569', // slate-600
  keypad: '#64748b', // slate-500-ish
  'smoke-detector': '#b45309', // amber-700
  'heat-detector': '#dc2626', // red-600
  'co-detector': '#0891b2', // cyan-600
  'manual-call-point': '#ca8a04', // yellow-600
  sounder: '#9333ea', // purple-600
}

/** Dash pattern (image px) for a TCVN-5738-derived (standard, not datasheet-printed) detector circle - see `fire-detector-coverage-shapes.tsx`. */
export const FIRE_DETECTOR_STANDARD_CIRCLE_DASH: number[] = [10, 6]
