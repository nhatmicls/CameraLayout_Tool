/**
 * Domain types for the Hikvision fire-alarm catalog (control panels, wireless
 * hubs, expander modules, keypads, detectors, call points, sounders) and the
 * placed-device shape used on the canvas. Pure data + small pure helpers
 * only - no React/Konva/`src/catalog` imports (enforced by
 * `no-react-konva-imports.test.ts`), same rule as `sensor-types.ts`.
 *
 * Deviation from the phase-3 sketch (phase 1 findings, `docs/fire-alarm-catalog-sources.md`
 * C1/C2): no shipped datasheet prints a protection radius or area, so there
 * is no `protection` field anywhere in this catalog - a detector circle only
 * ever comes from the TCVN 5738 table (`fire-detector-coverage-resolver.ts`).
 * C3: no series-level compatibility entry exists in the collected sources,
 * so `compatibleDevices` is model-level only (no `match` discriminator).
 */

/**
 * The nineteen device kinds this catalog ships. `intrusion-detector` is a motion /
 * glass-break detector with no official datasheet (no printed range), so it is a
 * marker here instead of a sensor-catalog record. The nine marker-only kinds added alongside
 * `FIRE_ALARM_KIND_CATALOG_TAB` (owner decision, AX Hybrid PRO compatibility
 * list expansion) carry no coverage shape - same as `expander-module` /
 * `keypad` / `sounder` already did - so adding them needed no change to
 * `isFireDetectorKind` or the coverage resolver, only new entries in every
 * exhaustive `Record<FireAlarmKind, ...>` table below and in
 * `src/canvas/fire-alarm`.
 */
export type FireAlarmKind =
  | 'control-panel'
  | 'wireless-hub'
  | 'expander-module'
  | 'keypad'
  | 'keyfob'
  | 'tag-reader'
  | 'relay-module'
  | 'repeater'
  | 'communicator'
  | 'power-supply'
  | 'accessory'
  | 'smoke-detector'
  | 'heat-detector'
  | 'co-detector'
  | 'manual-call-point'
  | 'sounder'
  | 'magnetic-contact'
  | 'environment-detector'
  | 'intrusion-detector'

/** The three detector kinds a coverage circle can ever be drawn for. */
export type FireDetectorKind = 'smoke-detector' | 'heat-detector' | 'co-detector'

/** The two kinds that manage other devices and can be checked for compatibility. */
export type FireAlarmControllerKind = 'control-panel' | 'wireless-hub'

type FireAlarmNonControllerKind = Exclude<FireAlarmKind, FireAlarmControllerKind>

export const FIRE_ALARM_KIND_LABELS: Record<FireAlarmKind, string> = {
  'control-panel': 'Control panel',
  'wireless-hub': 'Wireless hub',
  'expander-module': 'Expander module',
  keypad: 'Keypad',
  keyfob: 'Keyfob',
  'tag-reader': 'Tag reader',
  'relay-module': 'Relay module',
  repeater: 'Repeater',
  communicator: 'Communicator',
  'power-supply': 'Power supply',
  accessory: 'Accessory',
  'smoke-detector': 'Smoke detector',
  'heat-detector': 'Heat detector',
  'co-detector': 'CO detector',
  // The one shipped record (DS-PDEBP1-EG2-WE) is a portable panic button, not an EN 54-11
  // manual call point - see docs/fire-alarm-catalog-sources.md "Kind of DS-PDEBP1-EG2-WE".
  'manual-call-point': 'Call point / panic button',
  sounder: 'Sounder',
  'magnetic-contact': 'Magnetic contact',
  'environment-detector': 'Environment detector',
  'intrusion-detector': 'Intrusion detector',
}

/** Fixed display order used everywhere a UI lists all nineteen kinds (catalog tab filters, BOM grouping) - grouped by `FIRE_ALARM_KIND_CATALOG_TAB` (control-panel kinds, then fire-alarm kinds, then sensors-tab kinds). */
export const FIRE_ALARM_KIND_DISPLAY_ORDER: readonly FireAlarmKind[] = [
  'control-panel',
  'wireless-hub',
  'expander-module',
  'keypad',
  'keyfob',
  'tag-reader',
  'relay-module',
  'repeater',
  'communicator',
  'power-supply',
  'accessory',
  'smoke-detector',
  'heat-detector',
  'co-detector',
  'manual-call-point',
  'sounder',
  'magnetic-contact',
  'environment-detector',
  'intrusion-detector',
]

// The kind -> sidebar tab table lives in its own module (file-size rule); re-exported here so
// every consumer keeps importing kind tables from this file.
export { FIRE_ALARM_KIND_CATALOG_TAB } from './fire-alarm-kind-catalog-tab'

export function isFireAlarmControllerKind(kind: FireAlarmKind): kind is FireAlarmControllerKind {
  return kind === 'control-panel' || kind === 'wireless-hub'
}

export function isFireDetectorKind(kind: FireAlarmKind): kind is FireDetectorKind {
  return kind === 'smoke-detector' || kind === 'heat-detector' || kind === 'co-detector'
}

/**
 * A fire-alarm device placed on the floor plan. One shape, no `shape`
 * discriminator (unlike `PlacedSensor`): whether a coverage circle is drawn
 * depends on the catalog kind AND the project's `FireCoverageMode`, so
 * storing a radius here would go stale on a mode switch, and nothing here is
 * ever rotated or resized by the user.
 */
export interface PlacedFireAlarmDevice {
  id: string
  modelId: string
  /** Position in image pixels, x right, y down. */
  x: number
  y: number
}

/** One controller -> peripheral pairing, stored once on the controller record. */
export interface FireAlarmCompatibilityEntry {
  modelId: string
  sourceUrl: string
  sourceRetrieved: string
  note?: string
}

interface FireAlarmModelSpecCommon {
  id: string
  brand: string
  model: string
  productLine: 'ax-hybrid' | 'ax-pro' | 'standalone' | 'conventional'
  worksStandalone: boolean
  certificationsAsPrinted: readonly string[]
  /** Official datasheet / manual / product page, or null when none exists for the model. */
  sourceUrl: string | null
  sourceRetrieved: string
  /** Indicative Vietnam reseller price (VND), or null/omitted when no price is published - same shape as `SensorModelSpec.priceVn` (`sensor-types.ts`). */
  priceVn?: { amountVnd: number } | null
  /** Shop purchase links. Shop data, never read by domain logic - typed loosely so any catalog shape is assignable without an adapter. */
  purchaseLinks?: unknown
  notes?: string
}

/**
 * Minimal structural shape the domain needs from a catalog fire-alarm model.
 * Mirrors the phase-2 catalog record field-for-field (minus fields this
 * domain layer never reads). A discriminated union on `kind`: controller
 * members (`control-panel`, `wireless-hub`) carry `capacityAsPrinted` +
 * `compatibleDevices`; every other kind does not have those two fields at
 * all - so a real catalog record of either shape is assignable here with no
 * adapter. Defined locally (not imported from `src/catalog`) so real
 * catalog records satisfy this type by plain structural typing.
 */
export type FireAlarmModelSpec =
  | (FireAlarmModelSpecCommon & {
      kind: FireAlarmControllerKind
      capacityAsPrinted: readonly { label: string; value: string }[]
      compatibleDevices: readonly FireAlarmCompatibilityEntry[]
    })
  | (FireAlarmModelSpecCommon & { kind: FireAlarmNonControllerKind })

/** Which coverage rule a project uses to draw a detector's circle. */
export type FireCoverageMode = 'datasheet' | 'tcvn-5738'

export interface FireAlarmSettings {
  coverageMode: FireCoverageMode
  /** Ceiling height for the TCVN 5738 table lookup, metres, or null (not set / datasheet mode). */
  ceilingHeightM: number | null
}

export const DEFAULT_FIRE_ALARM_SETTINGS: FireAlarmSettings = {
  coverageMode: 'datasheet',
  ceilingHeightM: null,
}
