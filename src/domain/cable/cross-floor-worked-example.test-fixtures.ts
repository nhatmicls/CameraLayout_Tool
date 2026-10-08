import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS, type Cable, type Hub } from './cable-layout-types'
import type { Floor } from '../floor/floor-types'
import type { PlacedCamera, PlanImage, Project } from '../project-file/project-types'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../fire-alarm/fire-alarm-device-types'

/**
 * The worked example every cross-floor test (link integrity, exit resolver,
 * beyond-length resolver, the project-wide estimate, the store) shares.
 * Every reference line is 400 px with the default 3 px click error, so
 * every floor's scale-uncertainty factors are the SAME two numbers as the
 * single-floor worked example (`cable-worked-example.test-fixtures.ts`):
 * `minFactor = 400/406 = 0.9852216749...`, `maxFactor = 400/394 = 1.0152284264...`
 * - only each floor's `planPxPerMeter` (hence horizontal metres) differs.
 *
 * Floor 1 (lowest, `floorHeightM` 3): camera `cam-1` (mountHeightM 2.5, so
 * `deviceRiseM = |3 - 2.5| = 0.5`) cabled to riser `riser-1`
 * (100,100) -> (400,100) -> (400,500) -> (700,500) = 1000 px => 10 m at
 * 100 px/m. `riser-1` is linked to drop `drop-1` on floor 2.
 *
 * Floor 2 (`floorHeightM` 3.5, unused by this crossing - the vertical comes
 * from the RISER's own floor, floor 1's 3 m): `drop-1` at (700,500) has a
 * trunk to plain hub `plain-hub-2` at (900,800): (700,500)->(700,800)->(900,800)
 * = 500 px => 10 m at 50 px/m (ref line 400 px / 8 m). `plain-hub-2`
 * (mountHeightM 1.5, the hub default) is a dead end: typed contribution
 * `|3 - 1.5| = 1.5`.
 *
 * So the cable's `HubBeyondLength` (computed mode) is:
 *   crossingVerticalM = 3 (floor 1's floorHeightM)
 *   horizontal on floor 2 = 10 m (min 9.852217, max 10.152284)
 *   + plain-hub-2's typed 1.5 m
 *   run = { nominal: 14.5, min: 14.352217, max: 14.652284 }
 *
 * Full cable (device -> riser-1, continuing through drop-1's trunk):
 *   horizM (floor 1) = 10, deviceRiseM = 0.5, slackM = 3.5 (defaults)
 *   fixedM = 0.5 + 3.5 + 14.5 = 18.5
 *   run = { nominal: 28.5, min: 28.204433, max: 28.804569 }
 *   purchase (waste 15%) = { nominal: 32.775, min: 32.435099, max: 33.125254 }
 */

export const DUMMY_IMAGE: PlanImage = { dataUrl: 'data:image/png;base64,AA==', widthPx: 2000, heightPx: 2000, fileName: 'plan.png' }

export const CROSS_FLOOR_CAMERA: PlacedCamera = { id: 'cam-1', modelId: 'm', x: 100, y: 100, rotationDeg: 0, rangeM: 10, mountHeightM: 2.5, tiltDeg: 20 }

export const RISER_1: Hub = { id: 'riser-1', kind: 'riser', x: 700, y: 500, mountHeightM: 3, link: { floorId: 'floor-1', hubId: 'drop-1' } }
export const DROP_1: Hub = {
  id: 'drop-1',
  kind: 'drop',
  x: 700,
  y: 500,
  mountHeightM: 0,
  link: { floorId: 'floor-0', hubId: 'riser-1' },
  trunk: { hubId: 'plain-hub-2', points: [{ x: 700, y: 800 }] },
}
export const PLAIN_HUB_2: Hub = { id: 'plain-hub-2', x: 900, y: 800, mountHeightM: 1.5 }

export const CROSS_FLOOR_CABLE: Cable = {
  id: 'cross-cable-1',
  device: { kind: 'camera', id: 'cam-1' },
  hubId: 'riser-1',
  typeId: 'cat6-utp',
  points: [{ x: 400, y: 100 }, { x: 400, y: 500 }],
}

function emptyFloorFields() {
  return { cameras: [], walls: [], sensors: [], hubs: [], cables: [], fireAlarmDevices: [] }
}

/** Floor 0 (lowest) and floor 1, linked by `riser-1` <-> `drop-1` - the two-floor worked example above. */
export function twoFloorLinkedProject(overrides: { floor0?: Partial<Floor>; floor1?: Partial<Floor> } = {}): Project {
  const floor0: Floor = {
    id: 'floor-0',
    name: 'Floor 1',
    floorHeightM: 3,
    image: DUMMY_IMAGE,
    scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 400, y2: 0 }, refLengthM: 4 },
    ...emptyFloorFields(),
    cameras: [CROSS_FLOOR_CAMERA],
    hubs: [RISER_1],
    cables: [CROSS_FLOOR_CABLE],
    ...overrides.floor0,
  }
  const floor1: Floor = {
    id: 'floor-1',
    name: 'Floor 2',
    floorHeightM: 3.5,
    image: DUMMY_IMAGE,
    scale: { planPxPerMeter: 50, refLine: { x1: 0, y1: 0, x2: 400, y2: 0 }, refLengthM: 8 },
    ...emptyFloorFields(),
    hubs: [DROP_1, PLAIN_HUB_2],
    ...overrides.floor1,
  }
  return {
    floors: [floor0, floor1],
    shafts: [],
    cableTypes: createDefaultCableTypes(),
    cableSettings: { ...DEFAULT_CABLE_SETTINGS },
    fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
  }
}

/**
 * Chain over 3 floors: `plain-hub-2` (floor 1) becomes riser `riser-2`,
 * linked to drop `drop-2` on floor 2, whose own trunk reaches plain hub
 * `plain-hub-3`. Floor 1's `floorHeightM` is 2 (the second hop's vertical);
 * floor 2's own ref line/scale give the SAME uncertainty factors again
 * (400 px, 3 px click error) at 40 px/m (ref line 400 px / 10 m).
 *
 * Hop 2 (floor 1 -> floor 2): crossingVerticalM = 2 (floor 1's own height).
 *   horizontal (floor 2) = (900,800)->(900,1000)->(1100,1000) = 400 px => 10 m.
 *   + plain-hub-3 typed 1.5 m.
 *   run = { nominal: 13.5, min: 13.352217, max: 13.652284 }
 *
 * Hop 1 (floor 0 -> floor 1), the cable's own `HubBeyondLength`:
 *   crossingVerticalM = 3 (floor 0's own height).
 *   horizontal (floor 1) = 10 m (riser-2 replaces plain-hub-2 at the same spot).
 *   + hop 2's run (13.5 / 13.352217 / 13.652284).
 *   run = { nominal: 26.5, min: 26.204433, max: 26.804569 }
 *
 * Full cable: fixedM = 0.5 + 3.5 + 26.5 = 30.5; run = { nominal: 40.5,
 * min: 40.056650, max: 40.956853 }; purchase (15% waste) = { nominal:
 * 46.575, min: 46.065148, max: 47.100381 }.
 */
export function threeFloorChainProject(): Project {
  const base = twoFloorLinkedProject()
  const riser2: Hub = { id: 'riser-2', kind: 'riser', x: 900, y: 800, mountHeightM: 3, link: { floorId: 'floor-2', hubId: 'drop-2' } }
  const drop2: Hub = {
    id: 'drop-2',
    kind: 'drop',
    x: 900,
    y: 800,
    mountHeightM: 0,
    link: { floorId: 'floor-1', hubId: 'riser-2' },
    trunk: { hubId: 'plain-hub-3', points: [{ x: 900, y: 1000 }] },
  }
  const plainHub3: Hub = { id: 'plain-hub-3', x: 1100, y: 1000, mountHeightM: 1.5 }

  // drop-1, with its trunk repointed from `plain-hub-2` (removed in this fixture) to `riser-2`.
  const drop1ToRiser2: Hub = { ...base.floors[1].hubs[0], trunk: { hubId: 'riser-2', points: [{ x: 700, y: 800 }] } }
  const floor1 = { ...base.floors[1], floorHeightM: 2, hubs: [drop1ToRiser2, riser2] }
  const floor2: Floor = {
    id: 'floor-2',
    name: 'Floor 3',
    floorHeightM: 4,
    image: DUMMY_IMAGE,
    scale: { planPxPerMeter: 40, refLine: { x1: 0, y1: 0, x2: 400, y2: 0 }, refLengthM: 10 },
    ...emptyFloorFields(),
    hubs: [drop2, plainHub3],
  }
  return { ...base, floors: [base.floors[0], floor1, floor2] }
}
