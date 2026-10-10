import type { FireAlarmKind } from './fire-alarm-device-types'

/**
 * Designator prefix per fire-alarm kind (owner decision 2026-10-09) - the one
 * table every label site reads, through the shared allocator
 * (`floor-item-label-allocator.ts`'s `buildFloorItemLabels`, the one place
 * that turns this table into actual labels). Exhaustive: a new kind must be
 * given a prefix here. Expander module and call point share `E` (as the
 * owner named them), so they share one `E{n}` series.
 */
export const FIRE_ALARM_KIND_DESIGNATOR_PREFIX: Record<FireAlarmKind, string> = {
  'control-panel': 'P',
  'wireless-hub': 'PW',
  'expander-module': 'E',
  keypad: 'KP',
  keyfob: 'KF',
  'tag-reader': 'TR',
  'relay-module': 'R',
  repeater: 'REP',
  communicator: 'COM',
  'power-supply': 'PS',
  accessory: 'ACE',
  'smoke-detector': 'S',
  'heat-detector': 'H',
  'co-detector': 'CO',
  'manual-call-point': 'E',
  sounder: 'SO',
  'magnetic-contact': 'MAG',
  'environment-detector': 'ENV',
  'intrusion-detector': 'ID',
}

/** Catalog lookup the labels need: model id -> its kind. Passed in, because `src/domain` never imports `src/catalog`. */
export type FireAlarmKindByModelId = Readonly<Record<string, { kind: FireAlarmKind } | undefined>>
