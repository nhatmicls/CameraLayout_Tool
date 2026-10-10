import { describe, expect, it } from 'vitest'
import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import { DEFAULT_FIRE_ALARM_SETTINGS, type PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { Floor } from '../floor/floor-types'
import type { Project } from '../project-file/project-types'
import type { PlacedBeamSensor, PlacedSectorSensor } from '../sensor/sensor-types'
import { buildProjectCableEndToEndLabels, formatCableEndToEndLabel, resolveShaftLegLabels, selectCableLabelStrings } from './cable-end-to-end-label'
import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS, type Cable, type Hub } from './cable-layout-types'
import { CROSS_FLOOR_CABLE, threeFloorChainProject, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'
import { findShaftLegsOnFloor } from './shaft-cable-leg'
import { SHAFT_MARKER_F1, SHAFT_MARKER_F2, shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

const cam = (id: string, x = 0, y = 0) => ({ id, modelId: 'm', x, y, rotationDeg: 0, rangeM: 5 })

function floorWith(id: string, name: string, overrides: Partial<Floor> = {}): Floor {
  return { id, name, floorHeightM: 3, image: null, scale: null, cameras: [], walls: [], sensors: [], hubs: [], cables: [], fireAlarmDevices: [], ...overrides }
}

function projectOf(floors: Floor[]): Pick<Project, 'floors' | 'shafts'> {
  return { floors, shafts: [] }
}

describe('formatCableEndToEndLabel', () => {
  it('resolved ends on both sides', () => {
    expect(formatCableEndToEndLabel({ floorIndex: 0, label: 'C1' }, { floorIndex: 1, label: 'H1' })).toBe('F1_C1_F2_H1')
  })

  it('an unresolved end is a bare "?", never floor-prefixed', () => {
    expect(formatCableEndToEndLabel({ floorIndex: 0, label: 'C1' }, null)).toBe('F1_C1_?')
    expect(formatCableEndToEndLabel(null, { floorIndex: 1, label: 'H1' })).toBe('?_F2_H1')
    expect(formatCableEndToEndLabel(null, null)).toBe('?_?')
    expect(formatCableEndToEndLabel(undefined, undefined)).toBe('?_?')
  })
})

describe('buildProjectCableEndToEndLabels - same floor', () => {
  const sensors: Array<PlacedSectorSensor | PlacedBeamSensor> = [
    { id: 's1', modelId: 'p', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 },
    { id: 's2', modelId: 'p', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 },
    { id: 's3', modelId: 'p', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 },
    { id: 's4', modelId: 'b', shape: 'beam', x: 0, y: 0, x2: 10, y2: 10, environment: 'indoor' },
  ]
  const panel: PlacedFireAlarmDevice = { id: 'fa-1', modelId: 'panel', x: 0, y: 0 }
  const modelById: FireAlarmKindByModelId = { panel: { kind: 'control-panel' } }
  const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
  const cables: Cable[] = [
    { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] },
    { id: 'c2', device: { kind: 'sensor', id: 's2' }, hubId: 'h1', typeId: 't', points: [] },
    { id: 'c3', device: { kind: 'sensor', id: 's4', end: 'tx' }, hubId: 'h1', typeId: 't', points: [] },
    { id: 'c4', device: { kind: 'sensor', id: 's4', end: 'rx' }, hubId: 'h1', typeId: 't', points: [] },
    { id: 'c5', device: { kind: 'fire-alarm', id: 'fa-1' }, hubId: 'h1', typeId: 't', points: [] },
  ]
  const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], sensors, fireAlarmDevices: [panel], hubs: [hub], cables })
  const labels = buildProjectCableEndToEndLabels(projectOf([floor]), modelById).get('f1')!

  it('camera, sensor, beam ends and a fire-alarm start all read F1_<start>_F1_H1', () => {
    expect(labels.get('c1')?.label).toBe('F1_C1_F1_H1')
    expect(labels.get('c2')?.label).toBe('F1_S2_F1_H1')
    expect(labels.get('c3')?.label).toBe('F1_S4tx_F1_H1')
    expect(labels.get('c4')?.label).toBe('F1_S4rx_F1_H1')
    expect(labels.get('c5')?.label).toBe('F1_P1_F1_H1')
  })
})

describe('buildProjectCableEndToEndLabels - device end', () => {
  it('two cameras: F1_C1_F1_C2', () => {
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1'), cam('cam-2')] })
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-2' }, typeId: 't', points: [] }
    const labels = buildProjectCableEndToEndLabels(projectOf([{ ...floor, cables: [cable] }])).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_C1_F1_C2')
  })

  it('a sensor ending on a fire-alarm panel: F1_S1_F1_P1', () => {
    const sensor: PlacedSectorSensor = { id: 's1', modelId: 'p', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 }
    const panel: PlacedFireAlarmDevice = { id: 'fa-1', modelId: 'panel', x: 0, y: 0 }
    const cable: Cable = { id: 'c1', device: { kind: 'sensor', id: 's1' }, endDevice: { kind: 'fire-alarm', id: 'fa-1' }, typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { sensors: [sensor], fireAlarmDevices: [panel], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor]), { panel: { kind: 'control-panel' } }).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_S1_F1_P1')
  })

  it('omitting the fire-alarm catalog lookup reads the unknown-model prefix "?": F1_C1_F1_?1', () => {
    const panel: PlacedFireAlarmDevice = { id: 'fa-1', modelId: 'panel', x: 0, y: 0 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'fire-alarm', id: 'fa-1' }, typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], fireAlarmDevices: [panel], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_C1_F1_?1')
  })
})

describe('buildProjectCableEndToEndLabels - cable on floor 2 of 3', () => {
  it('reads F2_C1_F2_H1', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] }
    const floors = [
      floorWith('f1', 'Floor 1'),
      floorWith('f2', 'Floor 2', { cameras: [cam('cam-1')], hubs: [hub], cables: [cable] }),
      floorWith('f3', 'Floor 3'),
    ]
    const labels = buildProjectCableEndToEndLabels(projectOf(floors)).get('f2')!
    expect(labels.get('c1')?.label).toBe('F2_C1_F2_H1')
  })
})

describe('buildProjectCableEndToEndLabels - riser / drop pair chains', () => {
  it('reaches the final hub across floors: F1_C1_F2_H1', () => {
    const project = twoFloorLinkedProject()
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('floor-0')!
    expect(labels.get(CROSS_FLOOR_CABLE.id)?.label).toBe('F1_C1_F2_H1')
  })

  it('a chain that comes back to the cable\'s own floor: F1_C1_F1_H2', () => {
    const plainA: Hub = { id: 'plain-a', x: 0, y: 0, mountHeightM: 1.5 }
    const riser1: Hub = { id: 'riser-1', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'f2', hubId: 'drop-1' } }
    const drop2: Hub = { id: 'drop-2', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'f2', hubId: 'riser-2' }, trunk: { hubId: 'plain-b', points: [] } }
    const plainB: Hub = { id: 'plain-b', x: 0, y: 0, mountHeightM: 1.5 }
    const drop1: Hub = { id: 'drop-1', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'f1', hubId: 'riser-1' }, trunk: { hubId: 'riser-2', points: [] } }
    const riser2: Hub = { id: 'riser-2', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'f1', hubId: 'drop-2' } }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'riser-1', typeId: 't', points: [] }
    const floors = [
      floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [plainA, riser1, drop2, plainB], cables: [cable] }),
      floorWith('f2', 'Floor 2', { hubs: [drop1, riser2] }),
    ]
    const labels = buildProjectCableEndToEndLabels(projectOf(floors)).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_C1_F1_H2')
  })

  it('a multi-hop chain names the final hub only - no R/D/T letter from an intermediate hop', () => {
    const project = threeFloorChainProject()
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('floor-0')!
    expect(labels.get(CROSS_FLOOR_CABLE.id)?.label).toBe('F1_C1_F3_H1')
  })

  it('a typed (unlinked) riser is an open end: F1_C1_?', () => {
    const riser: Hub = { id: 'riser-x', kind: 'riser', x: 0, y: 0, mountHeightM: 3 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'riser-x', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [riser], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_C1_?')
  })
})

describe('buildProjectCableEndToEndLabels - a cable through a shaft', () => {
  it('not routed: F2_C1_?', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam('cam-c1')], cables: [shaftCable('c1', 'sm2')] }])
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('sf1')!
    expect(labels.get('c1')?.label).toBe('F2_C1_?')
  })

  it('leg to a hub on F1: F2_C1_F1_H1', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam('cam-c1')], cables: [shaftCable('c1', 'sm2', 'sf0')] }])
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('sf1')!
    expect(labels.get('c1')?.label).toBe('F2_C1_F1_H1')
  })

  it('leg to a fire-alarm panel on F3: F2_C1_F3_P1', () => {
    const panel: PlacedFireAlarmDevice = { id: 'fa-1', modelId: 'panel', x: 0, y: 0 }
    const cable: Cable = { ...shaftCable('c2', 'sm2'), beyondShaft: { floorId: 'sf2', points: [], endDevice: { kind: 'fire-alarm', id: 'fa-1' } } }
    const project = shaftFourFloorProject([{}, { cameras: [cam('cam-c2')], cables: [cable] }, { fireAlarmDevices: [panel] }])
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors), { panel: { kind: 'control-panel' } }).get('sf1')!
    expect(labels.get('c2')?.label).toBe('F2_C1_F3_P1')
  })

  it('leg to a riser with its own trunk chain: the chain\'s final (plain) hub, not the riser', () => {
    const riserOnF1: Hub = { id: 'riser-x', kind: 'riser', x: 400, y: 500, mountHeightM: 3, link: { floorId: 'sf1', hubId: 'drop-x' } }
    const dropOnF2: Hub = { id: 'drop-x', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'sf0', hubId: 'riser-x' }, trunk: { hubId: 'plain-y', points: [] } }
    const plainY: Hub = { id: 'plain-y', x: 100, y: 0, mountHeightM: 1.5 }
    const toRiser: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [{ x: 100, y: 500 }], hubId: 'riser-x' } }
    const project = shaftFourFloorProject([
      { hubs: [SHAFT_MARKER_F1, riserOnF1] },
      { cameras: [cam('cam-c1')], hubs: [SHAFT_MARKER_F2, dropOnF2, plainY], cables: [toRiser] },
    ])
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('sf1')!
    expect(labels.get('c1')?.label).toBe('F2_C1_F2_H1')
  })

  it('leg to a typed riser (not reached further): F2_C1_?', () => {
    const riserOnF1: Hub = { id: 'riser-x', kind: 'riser', x: 400, y: 500, mountHeightM: 3 }
    const toRiser: Cable = { ...shaftCable('c1', 'sm2'), beyondShaft: { floorId: 'sf0', points: [], hubId: 'riser-x' } }
    const project = shaftFourFloorProject([{ hubs: [SHAFT_MARKER_F1, riserOnF1] }, { cameras: [cam('cam-c1')], cables: [toRiser] }])
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('sf1')!
    expect(labels.get('c1')?.label).toBe('F2_C1_?')
  })
})

describe('buildProjectCableEndToEndLabels - defensive / crafted edges', () => {
  it('a cycle: the end reads "?"', () => {
    const project = twoFloorLinkedProject({
      floor0: {
        hubs: [
          { id: 'riser-1', kind: 'riser', x: 700, y: 500, mountHeightM: 3, link: { floorId: 'floor-1', hubId: 'drop-1' } },
          { id: 'drop-2', kind: 'drop', x: 0, y: 0, mountHeightM: 0, link: { floorId: 'floor-1', hubId: 'riser-2' }, trunk: { hubId: 'riser-1', points: [] } },
        ],
      },
      floor1: {
        hubs: [
          { id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'riser-1' }, trunk: { hubId: 'riser-2', points: [] } },
          { id: 'riser-2', kind: 'riser', x: 700, y: 500, mountHeightM: 3, link: { floorId: 'floor-0', hubId: 'drop-2' } },
        ],
      },
    })
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('floor-0')!
    expect(labels.get(CROSS_FLOOR_CABLE.id)?.label).toBe('F1_C1_?')
  })

  it('a missing end: F1_C1_?', () => {
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'gone', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_C1_?')
  })

  it('a missing start: ?_F1_H1', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'gone' }, hubId: 'h1', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { hubs: [hub], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.get('c1')?.label).toBe('?_F1_H1')
  })

  it('both ends missing: ?_?', () => {
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'gone' }, hubId: 'also-gone', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.get('c1')?.label).toBe('?_?')
  })

  it('a floor with scale: null along the route still resolves the final end (label never needs metres)', () => {
    const project = twoFloorLinkedProject({ floor1: { scale: null } })
    const labels = buildProjectCableEndToEndLabels(projectOf(project.floors)).get('floor-0')!
    expect(labels.get(CROSS_FLOOR_CABLE.id)?.label).toBe('F1_C1_F2_H1')
  })
})

describe('buildProjectCableEndToEndLabels - one-floor project', () => {
  it('still reads F1_C1_F1_H1; no label is ever "F{n}_F{n}_..."', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.get('c1')?.label).toBe('F1_C1_F1_H1')
    for (const entry of labels.values()) expect(entry.label).not.toMatch(/^F\d+_F\d+_/)
  })
})

describe('buildProjectCableEndToEndLabels - repeated end, memo', () => {
  it('two cables from the same camera to the same hub get two entries sharing one label', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cables: Cable[] = [
      { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] },
      { id: 'c2', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] },
    ]
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(labels.size).toBe(2)
    expect(labels.get('c1')?.label).toBe(labels.get('c2')?.label)
    expect(labels.get('c1')?.label).toBe('F1_C1_F1_H1')
  })

  it('memoises on (floors, shafts, fireAlarmModelById) by reference', () => {
    const project = twoFloorLinkedProject()
    const first = buildProjectCableEndToEndLabels(project)
    const second = buildProjectCableEndToEndLabels(project)
    expect(second).toBe(first)

    const freshFloors = buildProjectCableEndToEndLabels({ ...project, floors: [...project.floors] })
    expect(freshFloors).not.toBe(first)
    expect(freshFloors).toEqual(first)

    const modelById: FireAlarmKindByModelId = {}
    const withLookup1 = buildProjectCableEndToEndLabels(project, modelById)
    const withLookup2 = buildProjectCableEndToEndLabels(project, modelById)
    expect(withLookup2).toBe(withLookup1)
    expect(withLookup1).not.toBe(freshFloors) // different fireAlarmModelById reference -> recomputed
  })
})

// Sanity: the fixtures' own cableSettings/cableTypes/fireAlarmSettings are not read by the label
// builder at all - `Pick<Project, 'floors' | 'shafts'>` is enough. Exercised implicitly above via
// `projectOf`, which omits them; this just documents the shape is accepted when present too.
describe('selectCableLabelStrings', () => {
  it('reduces a floor\'s label map to cableId -> label', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    const strings = selectCableLabelStrings(labels)
    expect(strings.get('c1')).toBe('F1_C1_F1_H1')
  })

  it('caches by the input map\'s identity: the same map in gives the same map back', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables: [cable] })
    const labels = buildProjectCableEndToEndLabels(projectOf([floor])).get('f1')!
    expect(selectCableLabelStrings(labels)).toBe(selectCableLabelStrings(labels))
  })
})

describe('resolveShaftLegLabels', () => {
  it('reads a leg\'s label from its SOURCE floor (the floor its cable starts on), not the exit floor it is drawn on', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam('cam-c1')], cables: [shaftCable('c1', 'sm2', 'sf0')] }])
    const allLabels = buildProjectCableEndToEndLabels(projectOf(project.floors))
    const legs = findShaftLegsOnFloor(project.floors, 'sf0') // the leg is drawn on F1 (exit floor)
    const texts = resolveShaftLegLabels(legs, project.floors, allLabels)
    expect(texts).toEqual(['F2_C1_F1_H1']) // but the label is "F2_..." - the cable's own floor (F2, sourceFloorIndex)
  })

  it('an empty leg list returns an empty array', () => {
    const project = shaftFourFloorProject()
    const allLabels = buildProjectCableEndToEndLabels(projectOf(project.floors))
    expect(resolveShaftLegLabels([], project.floors, allLabels)).toEqual([])
  })
})

describe('buildProjectCableEndToEndLabels - accepts a full Project too', () => {
  it('ignores cableTypes/cableSettings/fireAlarmSettings', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 't', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables: [cable] })
    const full: Project = {
      floors: [floor],
      shafts: [],
      cableTypes: createDefaultCableTypes(),
      cableSettings: { ...DEFAULT_CABLE_SETTINGS },
      fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS },
    }
    expect(buildProjectCableEndToEndLabels(full).get('f1')!.get('c1')?.label).toBe('F1_C1_F1_H1')
  })
})
