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
  /** Omitted = a plain hub. `'shaft'` = one opening of a project-wide `Shaft` (see below) - requires `shaftId`, can never carry `link` (pair links are riser/drop only). */
  kind?: 'riser' | 'drop' | 'shaft'
  /** Required, and only meaningful, when `kind === 'shaft'`: which project `Shaft` this opening belongs to. At most one marker per shaft per floor. */
  shaftId?: string
  /** Position in image pixels, x right, y down. */
  x: number
  y: number
  /**
   * Metres, never negative. Hub: its height above this floor. Riser: the
   * height above this floor the cable rises to. Drop: how far BELOW this
   * floor the cable goes down to (`hubEffectiveHeightM` turns that into a
   * negative height). Shaft: unused (always 0) - a shaft's vertical metres
   * come from `floorHeightM`, never a typed height on the marker itself.
   */
  mountHeightM: number
  /**
   * Riser / drop: cable length on the other floor, beyond this point,
   * metres. Shaft opening: the typed "length beyond this opening" counted
   * for every cable entering here that is not routed beyond the shaft yet.
   * Omitted = 0.
   */
  extraLengthM?: number
  /**
   * Riser / drop only: the matching point on the ONE legal adjacent floor
   * (riser -> a drop on the next floor up; drop -> a riser on the next
   * floor down), always symmetric - both sides store the same pair. Unset
   * = typed mode (today's behaviour). See `cross-floor-hub-link-integrity.ts`.
   */
  link?: { floorId: string; hubId: string }
  /**
   * The drawn route from THIS point to another hub on ITS OWN floor,
   * continuing the crossing for cables arriving via this point (see
   * `cross-floor-exit-resolver.ts` / `cross-floor-hub-beyond-length-resolver.ts`).
   * `points` are the intermediate vertices, same convention as `Cable.points`.
   * Riser / drop only, and only meaningful while `link` is set. A shaft
   * opening never carries one: each cable owns its route beyond a shaft
   * (`Cable.beyondShaft`).
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
 * required for a beam and forbidden for every other sensor shape. A
 * fire-alarm device (any kind - panel, detector, module...) is one end.
 */
export type CableEndRef =
  | { kind: 'camera'; id: string }
  | { kind: 'sensor'; id: string; end?: 'tx' | 'rx' }
  | { kind: 'fire-alarm'; id: string }

export type CableDeviceKind = CableEndRef['kind']

export interface CablePoint {
  x: number
  y: number
}

/**
 * A cable's own route beyond the shaft opening it ends on: on the floor
 * `floorId`, from THAT floor's opening of the same shaft to a hub
 * (`hubId`, never a shaft opening) or a device (`endDevice`) there - exactly
 * one of the two. `points` are the intermediate vertices, opening -> end, in
 * that floor's image px. See `shaft-cable-leg.ts`.
 */
export interface CableShaftLeg {
  floorId: string
  points: CablePoint[]
  hubId?: string
  endDevice?: CableEndRef
}

/**
 * A route from a start device to an end on the same floor: a hub (`hubId`)
 * or another device (`endDevice`) - exactly one of the two, never the start
 * device itself. `points` = INTERMEDIATE vertices only, ordered start -> end.
 * Both ends derive from the live device / hub positions.
 */
export interface Cable {
  id: string
  device: CableEndRef
  hubId?: string
  endDevice?: CableEndRef
  typeId: string
  points: CablePoint[]
  /**
   * Only when the cable ends on a shaft opening: its own route on the exit
   * floor. Unset = not routed beyond the shaft yet (label "C1-?", counted up
   * to the shaft only).
   */
  beyondShaft?: CableShaftLeg
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
 * A vertical tube through several floors: a project-wide `{ id, name }`
 * entry. Its openings are hub markers on each floor it passes through
 * (`Hub.kind: 'shaft'`, `Hub.shaftId`), added separately - a shaft with no
 * markers yet still loads as-is.
 */
export interface Shaft {
  id: string
  name: string
}

export const MAX_SHAFTS = 20
export const SHAFT_NAME_MAX_LENGTH = 40
