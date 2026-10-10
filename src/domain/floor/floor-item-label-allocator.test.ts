import { describe, expect, it } from 'vitest'
import {
  buildFloorItemLabels,
  CAMERA_LABEL_PREFIX,
  HUB_LABEL_PREFIX,
  SENSOR_LABEL_PREFIX,
  SHAFT_LABEL_PREFIX,
  type FloorItems,
} from './floor-item-label-allocator'
import { FIRE_ALARM_KIND_DESIGNATOR_PREFIX, type FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { Hub } from '../cable/cable-layout-types'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSectorSensor } from '../sensor/sensor-types'

const modelById: FireAlarmKindByModelId = {
  smoke: { kind: 'smoke-detector' },
  heat: { kind: 'heat-detector' },
  relay: { kind: 'relay-module' },
  panel: { kind: 'control-panel' },
  co: { kind: 'co-detector' },
  communicator: { kind: 'communicator' },
  tagReader: { kind: 'tag-reader' },
  expander: { kind: 'expander-module' },
  callPoint: { kind: 'manual-call-point' },
  hub: { kind: 'wireless-hub' },
  keypad: { kind: 'keypad' },
  keyfob: { kind: 'keyfob' },
  repeater: { kind: 'repeater' },
  powerSupply: { kind: 'power-supply' },
  accessory: { kind: 'accessory' },
  sounder: { kind: 'sounder' },
  magnetic: { kind: 'magnetic-contact' },
  environment: { kind: 'environment-detector' },
  intrusion: { kind: 'intrusion-detector' },
}

function camera(id: string): PlacedCamera {
  return { id, modelId: 'cam', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function sensor(id: string): PlacedSectorSensor {
  return { id, modelId: 'sensor', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function device(id: string, modelId: string) {
  return { id, modelId, x: 0, y: 0 }
}

function hub(id: string, kind?: Hub['kind'], shaftId?: string): Hub {
  return { id, kind, shaftId, x: 0, y: 0, mountHeightM: 1.5 }
}

function floorOf(partial: Partial<FloorItems>): FloorItems {
  return { cameras: [], sensors: [], fireAlarmDevices: [], hubs: [], ...partial }
}

describe('buildFloorItemLabels', () => {
  it('only cameras: identical to today', () => {
    const floor = floorOf({ cameras: [camera('c1'), camera('c2')] })
    expect(buildFloorItemLabels(floor).cameras).toEqual(['C1', 'C2'])
  })

  it('only sensors: identical to today', () => {
    const floor = floorOf({ sensors: [sensor('s1'), sensor('s2')] })
    expect(buildFloorItemLabels(floor).sensors).toEqual(['S1', 'S2'])
  })

  it('only hubs: identical to today - hub/riser/drop each counted on its own', () => {
    const floor = floorOf({ hubs: [hub('h1'), hub('r1', 'riser'), hub('d1', 'drop'), hub('h2')] })
    expect(buildFloorItemLabels(floor).hubs).toEqual(['H1', 'R1', 'D1', 'H2'])
  })

  it('smoke + sensor: smoke S1, sensor S2, regardless of placement order', () => {
    const floor = floorOf({
      sensors: [sensor('s1')],
      fireAlarmDevices: [device('fa1', 'smoke')],
    })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById })
    expect(labels.fireAlarmDevices).toEqual(['S1'])
    expect(labels.sensors).toEqual(['S2'])
  })

  it('two smoke + two sensors: S1, S2 (smoke) then S3, S4 (sensors)', () => {
    const floor = floorOf({
      sensors: [sensor('s1'), sensor('s2')],
      fireAlarmDevices: [device('fa1', 'smoke'), device('fa2', 'smoke')],
    })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById })
    expect(labels.fireAlarmDevices).toEqual(['S1', 'S2'])
    expect(labels.sensors).toEqual(['S3', 'S4'])
  })

  it('heat + plain hub -> H1 then H2', () => {
    const floor = floorOf({ hubs: [hub('h1')], fireAlarmDevices: [device('fa1', 'heat')] })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById })
    expect(labels.fireAlarmDevices).toEqual(['H1'])
    expect(labels.hubs).toEqual(['H2'])
  })

  it('relay + riser -> R1 then R2; a drop is unaffected', () => {
    const floor = floorOf({ hubs: [hub('r1', 'riser'), hub('d1', 'drop')], fireAlarmDevices: [device('fa1', 'relay')] })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById })
    expect(labels.fireAlarmDevices).toEqual(['R1'])
    expect(labels.hubs).toEqual(['R2', 'D1'])
  })

  it('expander module and call point still share the one E series, in fireAlarmDevices[] order', () => {
    const floor = floorOf({ fireAlarmDevices: [device('fa1', 'expander'), device('fa2', 'callPoint'), device('fa3', 'expander')] })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById })
    expect(labels.fireAlarmDevices).toEqual(['E1', 'E2', 'E3'])
  })

  // Moved from the deleted `fire-alarm-device-designator.test.ts` (phase 5: that function was
  // deleted, its label-table coverage lives here now).
  it('every fire-alarm kind uses its own designator prefix (moved from fire-alarm-device-designator.test.ts)', () => {
    const kinds = ['panel', 'hub', 'keypad', 'keyfob', 'tagReader', 'relay', 'repeater', 'communicator', 'powerSupply', 'accessory']
    const floor1 = floorOf({ fireAlarmDevices: kinds.map((modelId, i) => device(`d${i}`, modelId)) })
    expect(buildFloorItemLabels(floor1, { fireAlarmModelById: modelById }).fireAlarmDevices).toEqual([
      'P1', 'PW1', 'KP1', 'KF1', 'TR1', 'R1', 'REP1', 'COM1', 'PS1', 'ACE1',
    ])

    const detectorKinds = ['smoke', 'heat', 'co', 'callPoint', 'sounder', 'magnetic', 'environment', 'intrusion']
    const floor2 = floorOf({ fireAlarmDevices: detectorKinds.map((modelId, i) => device(`d${i}`, modelId)) })
    expect(buildFloorItemLabels(floor2, { fireAlarmModelById: modelById }).fireAlarmDevices).toEqual([
      'S1', 'H1', 'CO1', 'E1', 'SO1', 'MAG1', 'ENV1', 'ID1',
    ])
  })

  it('numbers alternating smoke/heat/sounder devices each on their own prefix, in devices[] order', () => {
    const floor = floorOf({
      fireAlarmDevices: ['smoke', 'heat', 'smoke', 'sounder', 'heat', 'smoke'].map((modelId, i) => device(`d${i}`, modelId)),
    })
    expect(buildFloorItemLabels(floor, { fireAlarmModelById: modelById }).fireAlarmDevices).toEqual(['S1', 'H1', 'S2', 'SO1', 'H2', 'S3'])
  })

  it('every non-colliding alarm prefix counts alone - CO1 does not consume a camera number, TR1 does not touch T', () => {
    const floor = floorOf({
      cameras: [camera('c1')],
      hubs: [hub('shaft1', 'shaft', 'shaft-a')],
      fireAlarmDevices: [device('fa1', 'co'), device('fa2', 'communicator'), device('fa3', 'tagReader')],
    })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById, shaftIds: ['shaft-a'] })
    expect(labels.cameras).toEqual(['C1'])
    expect(labels.fireAlarmDevices).toEqual(['CO1', 'COM1', 'TR1'])
    expect(labels.hubs).toEqual(['T1'])
  })

  it('unknown alarm model -> ?{n}', () => {
    const floor = floorOf({ fireAlarmDevices: [device('fa1', 'does-not-exist'), device('fa2', 'smoke'), device('fa3', 'does-not-exist')] })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById })
    expect(labels.fireAlarmDevices).toEqual(['?1', 'S1', '?2'])
  })

  it('lookup omitted -> every alarm device is ?{n}, and hubs are NOT shifted', () => {
    const floor = floorOf({ hubs: [hub('h1')], fireAlarmDevices: [device('fa1', 'heat')] })
    const labels = buildFloorItemLabels(floor)
    expect(labels.fireAlarmDevices).toEqual(['?1'])
    expect(labels.hubs).toEqual(['H1'])
  })

  it('shaft marker -> T{n} from shaftIds, unaffected by any floor item', () => {
    const floor = floorOf({
      cameras: [camera('c1')],
      fireAlarmDevices: [device('fa1', 'heat')],
      hubs: [hub('h1'), hub('sm', 'shaft', 'shaft-b')],
    })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById, shaftIds: ['shaft-a', 'shaft-b'] })
    expect(labels.hubs).toEqual(['H2', 'T2'])
  })

  it('shaftIds omitted -> shaft markers count floor-locally', () => {
    const floor = floorOf({ hubs: [hub('sm1', 'shaft', 'shaft-a'), hub('sm2', 'shaft', 'shaft-b')] })
    expect(buildFloorItemLabels(floor).hubs).toEqual(['T1', 'T2'])
  })

  it('all labels on one floor are unique, shaft markers included', () => {
    const floor = floorOf({
      cameras: [camera('c1'), camera('c2')],
      sensors: [sensor('s1')],
      fireAlarmDevices: [device('fa1', 'smoke'), device('fa2', 'heat'), device('fa3', 'panel')],
      hubs: [hub('h1'), hub('r1', 'riser'), hub('sm', 'shaft', 'shaft-a')],
    })
    const labels = buildFloorItemLabels(floor, { fireAlarmModelById: modelById, shaftIds: ['shaft-a'] })
    const all = [...labels.cameras, ...labels.sensors, ...labels.fireAlarmDevices, ...labels.hubs]
    expect(new Set(all).size).toBe(all.length)
  })

  it('guard: no designator prefix equals the shaft prefix "T"', () => {
    expect(Object.values(FIRE_ALARM_KIND_DESIGNATOR_PREFIX)).not.toContain(SHAFT_LABEL_PREFIX)
  })

  it('guard: the set of prefixes shared between families is exactly {S, H, R} (+E inside alarm itself)', () => {
    const alarmPrefixes = new Set(Object.values(FIRE_ALARM_KIND_DESIGNATOR_PREFIX))
    const nonAlarmPrefixes = new Set<string>([CAMERA_LABEL_PREFIX, SENSOR_LABEL_PREFIX, ...Object.values(HUB_LABEL_PREFIX)])
    const shared = [...alarmPrefixes].filter((prefix) => nonAlarmPrefixes.has(prefix))
    expect(new Set(shared)).toEqual(new Set(['S', 'H', 'R']))

    // Within the alarm table itself, only expander-module/manual-call-point ("E") share a prefix.
    const alarmPrefixCounts = new Map<string, number>()
    for (const prefix of Object.values(FIRE_ALARM_KIND_DESIGNATOR_PREFIX)) {
      alarmPrefixCounts.set(prefix, (alarmPrefixCounts.get(prefix) ?? 0) + 1)
    }
    const duplicatedAlarmPrefixes = [...alarmPrefixCounts.entries()].filter(([, count]) => count > 1).map(([prefix]) => prefix)
    expect(duplicatedAlarmPrefixes).toEqual(['E'])
  })

  it('output arrays are index-aligned with inputs; inputs are never mutated', () => {
    const cameras = [camera('c1'), camera('c2')]
    const floor = floorOf({ cameras })
    const labels = buildFloorItemLabels(floor)
    expect(labels.cameras).toHaveLength(cameras.length)
    expect(cameras).toEqual([camera('c1'), camera('c2')])
  })

  it('memo: the same floor object + the same ctx refs return the same result object', () => {
    const floor = floorOf({ cameras: [camera('c1')] })
    const shaftIds: readonly string[] = ['shaft-a']
    const first = buildFloorItemLabels(floor, { shaftIds, fireAlarmModelById: modelById })
    const second = buildFloorItemLabels(floor, { shaftIds, fireAlarmModelById: modelById })
    expect(first).toBe(second)
  })

  it('memo: a different ctx ref recomputes (still correct, no stale hit)', () => {
    const floor = floorOf({ hubs: [hub('sm', 'shaft', 'shaft-a')] })
    const first = buildFloorItemLabels(floor, { shaftIds: ['shaft-a'] })
    const second = buildFloorItemLabels(floor, { shaftIds: ['shaft-a'] })
    expect(first).not.toBe(second) // different array refs, same content - a fresh, still-correct result
    expect(first).toEqual(second)
  })
})
