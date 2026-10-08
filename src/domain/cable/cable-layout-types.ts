/**
 * Domain types for the cable layout: hubs (where cables end), hand-drawn
 * cable routes from a device to a hub, the user's cable types and the
 * allowances the length estimate uses. Pure data + constants only - no
 * React/Konva/`src/catalog` imports (enforced by `no-react-konva-imports.test.ts`).
 *
 * Everything on disk is image px; metres are always computed
 * (`cable-length-estimate-calculator.ts`), never stored.
 */

/**
 * Where cables end. A plain hub is a network switch / recorder / panel on
 * this floor. A riser (`kind: 'riser'`) / a drop (`kind: 'drop'`) is the
 * point where cables leave this plan for the floor above / below.
 */
export interface Hub {
  id: string
  /** Omitted = a plain hub. */
  kind?: 'riser' | 'drop'
  /** Position in image pixels, x right, y down. */
  x: number
  y: number
  /**
   * Metres, never negative. Hub: its height above this floor. Riser: the
   * height above this floor the cable rises to. Drop: how far BELOW this
   * floor the cable goes down to (`hubEffectiveHeightM` turns that into a
   * negative height).
   */
  mountHeightM: number
  /** Riser / drop only: cable length on the other floor, beyond this point, metres. Omitted = 0. */
  extraLengthM?: number
  /**
   * Riser / drop only: the matching point on the ONE legal adjacent floor
   * (riser -> a drop on the next floor up; drop -> a riser on the next
   * floor down), always symmetric - both sides store the same pair. Unset
   * = typed mode (today's behaviour). See `cross-floor-hub-link-integrity.ts`.
   */
  link?: { floorId: string; hubId: string }
  /**
   * Riser / drop only, and only meaningful while `link` is set: the drawn
   * route from THIS point to another hub on ITS OWN floor, continuing the
   * crossing for cables arriving via the partner on the other floor (see
   * `cross-floor-exit-resolver.ts` / `cross-floor-hub-beyond-length-resolver.ts`).
   * `points` are the intermediate vertices, same convention as `Cable.points`.
   * Drawn starting phase 5; stored and estimated from this phase on.
   */
  trunk?: { hubId: string; points: CablePoint[] }
}

/** Height of the hub end relative to this floor: negative for a drop, which ends below it. */
export function hubEffectiveHeightM(hub: Pick<Hub, 'kind' | 'mountHeightM'>): number {
  return hub.kind === 'drop' ? -hub.mountHeightM : hub.mountHeightM
}

/** Addresses one hub on one floor - shared by every cross-floor-link function and store action (`Hub.link`/`Hub.trunk.hubId` use the same two-key shape). */
export interface HubRef {
  floorId: string
  hubId: string
}

/**
 * The device end of a cable. Ids are unique only within a kind, so the ref
 * carries `kind`. A beam sensor is one sensor with two ends: `end` is
 * required for a beam and forbidden for every other sensor shape.
 */
export type CableEndRef =
  | { kind: 'camera'; id: string }
  | { kind: 'sensor'; id: string; end?: 'tx' | 'rx' }

export interface CablePoint {
  x: number
  y: number
}

/** `points` = INTERMEDIATE vertices only, ordered device -> hub. Both ends derive from the live device / hub positions. */
export interface Cable {
  id: string
  device: CableEndRef
  hubId: string
  typeId: string
  points: CablePoint[]
}

export interface CableType {
  id: string
  name: string
  /** Maximum installed run in metres, or null = no limit checked. */
  lengthLimitM: number | null
  /** User-entered price per metre in VND, or null = price on request. Never invented or prefilled. */
  pricePerMeterVnd: number | null
}

export interface CableSettings {
  /** Scrap allowance added on top of the whole run, percent. */
  wastePercent: number
  /** Height the cable runs at (ceiling / tray), metres. */
  routeHeightM: number
  /** Device height used when the device has no mounting height of its own, metres. */
  defaultDeviceHeightM: number
  deviceEndSlackM: number
  hubEndSlackM: number
  /** How far off, in image px, each calibration click may be. */
  clickErrorPx: number
}

export const DEFAULT_HUB_MOUNT_HEIGHT_M = 1.5

export const DEFAULT_CABLE_SETTINGS: CableSettings = {
  wastePercent: 15,
  routeHeightM: 3,
  defaultDeviceHeightM: 3,
  deviceEndSlackM: 0.5,
  hubEndSlackM: 3,
  clickErrorPx: 3,
}

export const CABLE_SETTINGS_BOUNDS: Record<keyof CableSettings, { min: number; max: number }> = {
  wastePercent: { min: 0, max: 50 },
  routeHeightM: { min: 0, max: 30 },
  defaultDeviceHeightM: { min: 0, max: 30 },
  deviceEndSlackM: { min: 0, max: 20 },
  hubEndSlackM: { min: 0, max: 50 },
  clickErrorPx: { min: 0, max: 20 },
}

export const HUB_MOUNT_HEIGHT_BOUNDS = { min: 0, max: 30 }
export const HUB_EXTRA_LENGTH_BOUNDS = { min: 0, max: 500 }

export const MAX_HUBS = 100
export const MAX_CABLES = 1000
export const MAX_CABLE_POINTS = 200
export const MAX_CABLE_TYPES = 30
export const CABLE_TYPE_NAME_MAX_LENGTH = 60
/** A length limit is null or within (0, 10000] metres. */
export const CABLE_LENGTH_LIMIT_MAX_M = 10_000
/** A price is null or an integer within [0, 1e8] VND per metre. */
export const CABLE_PRICE_MAX_VND_PER_M = 100_000_000

/**
 * The cable types a new project starts with. A fresh array each call: store
 * state must not share one mutable default. Prices are null - never invented.
 * The 90 m limit is the permanent-link length of structured twisted-pair cabling.
 */
export function createDefaultCableTypes(): CableType[] {
  return [
    { id: 'cat6-utp', name: 'Cat6 UTP', lengthLimitM: 90, pricePerMeterVnd: null },
    { id: 'power-2-core', name: 'Power 2-core', lengthLimitM: null, pricePerMeterVnd: null },
    { id: 'alarm-signal', name: 'Alarm signal', lengthLimitM: null, pricePerMeterVnd: null },
  ]
}

/** The four cable fields of a `Project`, as one unit (the store slice and the file loader both carry exactly these). */
export interface CableLayout {
  hubs: Hub[]
  cables: Cable[]
  /** Never empty in memory: the last type cannot be deleted and an empty list in a file is reseeded. */
  cableTypes: CableType[]
  cableSettings: CableSettings
}

/** A project with no hubs or cables, the default cable types and the default allowances. Fresh objects each call. */
export function createEmptyCableLayout(): CableLayout {
  return { hubs: [], cables: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
}

/**
 * A vertical tube through several floors (phase 1: project-wide list only).
 * Its openings are hub markers on each floor it passes through
 * (`Hub.kind: 'shaft'`, `Hub.shaftId`) - added in a later phase, so a shaft
 * with no markers yet still loads as-is.
 */
export interface Shaft {
  id: string
  name: string
}

export const MAX_SHAFTS = 20
export const SHAFT_NAME_MAX_LENGTH = 40
