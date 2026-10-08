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
  // Control-panel-tab accessories (CLAUDE.md FIRE_ALARM_KIND_CATALOG_TAB): stone/zinc
  // neutrals, continuing the controller cabinet's grey family without reusing a shade.
  keyfob: '#78716c', // stone-500
  'tag-reader': '#57534e', // stone-600
  'relay-module': '#52525b', // zinc-600
  repeater: '#71717a', // zinc-500
  communicator: '#3f3f46', // zinc-700
  'power-supply': '#2563eb', // blue-600
  accessory: '#a8a29e', // stone-400
  'smoke-detector': '#b45309', // amber-700
  'heat-detector': '#dc2626', // red-600
  'co-detector': '#0891b2', // cyan-600
  'manual-call-point': '#ca8a04', // yellow-600
  sounder: '#9333ea', // purple-600
  // Sensors-tab fire-alarm kinds: blue family, distinct from both the sensor catalog's own
  // teal/indigo/fuchsia/rose palette and the DORI green->orange family.
  'magnetic-contact': '#1d4ed8', // blue-700
  'environment-detector': '#0ea5e9', // sky-500 (water/environment cue)
  'intrusion-detector': '#3b82f6', // blue-500
}

/** Dash pattern (image px) for a TCVN-5738-derived (standard, not datasheet-printed) detector circle - see `fire-detector-coverage-shapes.tsx`. */
export const FIRE_DETECTOR_STANDARD_CIRCLE_DASH: number[] = [10, 6]
