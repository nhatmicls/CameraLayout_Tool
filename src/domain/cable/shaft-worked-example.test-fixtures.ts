import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS, type Cable, type CableShaftLeg, type Hub } from './cable-layout-types'
import type { Floor } from '../floor/floor-types'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../fire-alarm/fire-alarm-device-types'
import type { PlanImage, Project } from '../project-file/project-types'

/**
 * The 4-floor shaft worked example every shaft test builds on: one marker
 * on each floor (`sf0`..`sf3`, floor names "F1".."F4") and a hub on F1
 * (`h1`) and F3 (`h2`). A cable owns its route beyond the shaft; the two
 * routes these tests use are `LEG_TO_F1` (F1's marker -> `h1`) and
 * `LEG_TO_F3` (F3's marker -> `h2`). Floor heights 3 / 3.5 / 2.5 / 4 (F4's own height is
 * unused - nothing rises above the top floor). Every floor's scale is the
 * SAME 100 px/m (400 px / 4 m reference line) as the pair worked example
 * (`cross-floor-worked-example.test-fixtures.ts`), so every floor's scale
 * uncertainty factors are the same two numbers: `minFactor =
 * 400/406 = 0.9852216749...`, `maxFactor = 400/394 = 1.0152284264...`.
 *
 * `LEG_TO_F1`: (100,100)->(100,500)->(400,500) = 700 px => 7 m.
 * `LEG_TO_F3`: (100,100)->(100,300) = 200 px => 2 m.
 * H1/H2 both `mountHeightM` 1.5 (the hub default); `routeHeightM` 3
 * (default) => each hub's own typed drop beyond it = `|3 - 1.5| = 1.5` m.
 *
 * `sumFloorHeightsBetween` (order-independent) between any two of the four:
 *   F1<->F2 = 3            F1<->F3 = 3+3.5 = 6.5        F1<->F4 = 3+3.5+2.5 = 9
 *   F2<->F3 = 3.5          F2<->F4 = 3.5+2.5 = 6
 *   F3<->F4 = 2.5          entry == exit = 0
 *
 * So a cable ending on F2's marker (`sf1`) (its own horizontal/vertical
 * contribution before reaching the shaft is whatever the test adds):
 *   leg to F1: crossingVerticalM = 3; horizontal on F1 (that floor's scale) =
 *     7 m (min 6.896552, max 7.106599); + H1's typed 1.5 m beyond it.
 *     `HubBeyondLength.run` = { nominal: 11.5, min: 11.296552, max: 11.706599 }.
 *   leg to F3: crossingVerticalM = 3.5; horizontal on F3 = 2 m (min 1.970443,
 *     max 2.030457); + H2's typed 1.5 m. `run` = { nominal: 7, min:
 *     6.970443, max: 7.030457 }.
 */
export const SHAFT_ID = 'shaft-1'
export const DUMMY_IMAGE: PlanImage = { dataUrl: 'data:image/png;base64,AA==', widthPx: 2000, heightPx: 2000, fileName: 'plan.png' }
const SCALE = { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 400, y2: 0 }, refLengthM: 4 }

export const SHAFT_MARKER_F1: Hub = { id: 'sm1', kind: 'shaft', shaftId: SHAFT_ID, x: 100, y: 100, mountHeightM: 0 }
export const LEG_TO_F1: CableShaftLeg = { floorId: 'sf0', points: [{ x: 100, y: 500 }], hubId: 'h1' }
export const HUB_H1: Hub = { id: 'h1', x: 400, y: 500, mountHeightM: 1.5 }
export const SHAFT_MARKER_F2: Hub = { id: 'sm2', kind: 'shaft', shaftId: SHAFT_ID, x: 50, y: 50, mountHeightM: 0 }
export const SHAFT_MARKER_F3: Hub = { id: 'sm3', kind: 'shaft', shaftId: SHAFT_ID, x: 100, y: 100, mountHeightM: 0 }
export const LEG_TO_F3: CableShaftLeg = { floorId: 'sf2', points: [], hubId: 'h2' }
export const HUB_H2: Hub = { id: 'h2', x: 100, y: 300, mountHeightM: 1.5 }
export const SHAFT_MARKER_F4: Hub = { id: 'sm4', kind: 'shaft', shaftId: SHAFT_ID, x: 50, y: 50, mountHeightM: 0 }

function emptyFloorFields() {
  return { cameras: [], walls: [], sensors: [], hubs: [], cables: [], fireAlarmDevices: [] }
}

/** A cable ending on `hubId`. `legFloorId` gives it its own route beyond the shaft: `'sf0'` = `LEG_TO_F1`, `'sf2'` = `LEG_TO_F3`; omitted = not routed. */
export function shaftCable(id: string, hubId: string, legFloorId?: 'sf0' | 'sf2'): Cable {
  const beyondShaft = legFloorId === 'sf0' ? LEG_TO_F1 : legFloorId === 'sf2' ? LEG_TO_F3 : undefined
  return { id, device: { kind: 'camera', id: `cam-${id}` }, hubId, typeId: 'cat6-utp', points: [], ...(beyondShaft ? { beyondShaft } : {}) }
}

/**
 * The 4-floor shaft project. `floorOverrides[i]` overrides floor `i`'s
 * fields (e.g. to add cables, drop a marker, or null a scale).
 */
export function shaftFourFloorProject(floorOverrides: Partial<Floor>[] = []): Project {
  const defs = [
    { id: 'sf0', name: 'F1', floorHeightM: 3, hubs: [SHAFT_MARKER_F1, HUB_H1] },
    { id: 'sf1', name: 'F2', floorHeightM: 3.5, hubs: [SHAFT_MARKER_F2] },
    { id: 'sf2', name: 'F3', floorHeightM: 2.5, hubs: [SHAFT_MARKER_F3, HUB_H2] },
    { id: 'sf3', name: 'F4', floorHeightM: 4, hubs: [SHAFT_MARKER_F4] },
  ]
  const floors: Floor[] = defs.map((def, i) => ({
    id: def.id,
    name: def.name,
    floorHeightM: def.floorHeightM,
    image: DUMMY_IMAGE,
    scale: SCALE,
    ...emptyFloorFields(),
    hubs: def.hubs,
    ...floorOverrides[i],
  }))
  return {
    floors,
    shafts: [{ id: SHAFT_ID, name: 'Main shaft' }],
    cableTypes: createDefaultCableTypes(),
    cableSettings: { ...DEFAULT_CABLE_SETTINGS },
    fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
  }
}
