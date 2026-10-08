import type { FireAlarmKind } from './fire-alarm-device-types'

/**
 * Which catalog sidebar tab shows a given kind - owner decision: compatibility
 * is controller-centric, so a control panel / hub's own modules and
 * accessories live in their own "Control panel" tab (never assumed, so a
 * future fire control panel can list fire devices only), smoke/heat/CO
 * detectors + call points + sounders stay in "Fire alarm", and the two
 * marker-only detector-like kinds (magnetic contact, environment detector,
 * and intrusion detector = a motion / glass-break detector with no datasheet)
 * join the security-sensor catalog in "Sensors" - motion and glass-break
 * detectors from the same AX Hybrid PRO list go into the SENSOR catalog
 * instead (a separate catalog, not this one). Every consumer that needs to
 * know "which tab" (the three catalog list components) reads this table
 * instead of re-deriving it.
 */
export const FIRE_ALARM_KIND_CATALOG_TAB: Record<FireAlarmKind, 'sensors' | 'fire-alarm' | 'control-panel'> = {
  'control-panel': 'control-panel',
  'wireless-hub': 'control-panel',
  'expander-module': 'control-panel',
  keypad: 'control-panel',
  keyfob: 'control-panel',
  'tag-reader': 'control-panel',
  'relay-module': 'control-panel',
  repeater: 'control-panel',
  communicator: 'control-panel',
  'power-supply': 'control-panel',
  accessory: 'control-panel',
  'smoke-detector': 'fire-alarm',
  'heat-detector': 'fire-alarm',
  'co-detector': 'fire-alarm',
  'manual-call-point': 'fire-alarm',
  sounder: 'fire-alarm',
  'magnetic-contact': 'sensors',
  'environment-detector': 'sensors',
  'intrusion-detector': 'sensors',
}
