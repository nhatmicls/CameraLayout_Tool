import type { FireAlarmKind, PlacedFireAlarmDevice } from './fire-alarm-device-types'

/**
 * Designator prefix per fire-alarm kind (owner decision 2026-10-09) - the one
 * table every label site reads (canvas markers, properties panel, BOM rows,
 * compatibility warnings, PNG legend). Exhaustive: a new kind must be given
 * a prefix here. Expander module and call point share `E` (as the owner
 * named them), so they share one `E{n}` series - see
 * `buildFireAlarmDeviceLabels`.
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

/** Prefix of a device whose catalog model is unknown (removed since save). */
const UNKNOWN_MODEL_FIRE_ALARM_DESIGNATOR_PREFIX = 'F'

/**
 * Label of every placed fire-alarm device on ONE floor, index-aligned with
 * `devices`: `{prefix}{n}`, where `n` counts per PREFIX (not per kind) in
 * `devices[]` order (`S1`, `S2`, `H1`, `KP1`...), so two kinds sharing a
 * prefix can never produce the same label twice. Derived, never stored - same rule as `C{n}` / `S{n}`.
 */
export function buildFireAlarmDeviceLabels(
  devices: readonly PlacedFireAlarmDevice[],
  modelById: FireAlarmKindByModelId,
): string[] {
  const countByPrefix = new Map<string, number>()
  return devices.map((device) => {
    const kind = modelById[device.modelId]?.kind
    const prefix = kind ? FIRE_ALARM_KIND_DESIGNATOR_PREFIX[kind] : UNKNOWN_MODEL_FIRE_ALARM_DESIGNATOR_PREFIX
    const n = (countByPrefix.get(prefix) ?? 0) + 1
    countByPrefix.set(prefix, n)
    return `${prefix}${n}`
  })
}
