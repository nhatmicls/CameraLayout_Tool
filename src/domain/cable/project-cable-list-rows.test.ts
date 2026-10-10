import { describe, expect, it } from 'vitest'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../fire-alarm/fire-alarm-device-types'
import type { Floor } from '../floor/floor-types'
import type { Project } from '../project-file/project-types'
import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS, type Cable, type CableSettings, type Hub } from './cable-layout-types'
import { CROSS_FLOOR_CABLE, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'
import { computeProjectCableEstimate } from './project-cable-layout-estimate'
import { buildProjectCableListRows, cableListToCsvTable, type CableListProject } from './project-cable-list-rows'
import { shaftCable, shaftFourFloorProject } from './shaft-worked-example.test-fixtures'

/** `computeProjectCableEstimate` needs a full `Project`; the rows builder's own `CableListProject` input omits `fireAlarmSettings` (never read), so the test's own cross-check calls add it back. */
const asFullProject = (project: CableListProject): Project => ({ ...project, fireAlarmSettings: DEFAULT_FIRE_ALARM_SETTINGS })

const cam = (id: string) => ({ id, modelId: 'm', x: 0, y: 0, rotationDeg: 0, rangeM: 10 })
const SCALE = { planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 }

function floorWith(id: string, name: string, overrides: Partial<Floor> = {}): Floor {
  return { id, name, floorHeightM: 3, image: null, scale: SCALE, cameras: [], walls: [], sensors: [], hubs: [], cables: [], fireAlarmDevices: [], ...overrides }
}

/** One floor, a plain hub, two cameras each cabled straight to it. */
function twoCableProject(settingsOverrides: Partial<CableSettings> = {}): CableListProject {
  const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
  const cables: Cable[] = [
    { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 'cat6-utp', points: [] },
    { id: 'c2', device: { kind: 'camera', id: 'cam-2' }, hubId: 'h1', typeId: 'cat6-utp', points: [] },
  ]
  const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1'), cam('cam-2')], hubs: [hub], cables })
  return { floors: [floor], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS, ...settingsOverrides } }
}

describe('buildProjectCableListRows - basic estimate', () => {
  it('one floor, 2 estimated cables: labels, type name, lengthWithSpare equals the estimate\'s purchase (not run)', () => {
    const project = twoCableProject()
    const rows = buildProjectCableListRows(project)
    expect(rows).toHaveLength(2)
    const byId = computeProjectCableEstimate(asFullProject(project)).byFloorId.get('f1')!.byCableId
    for (const row of rows) {
      const estimate = byId.get(row.cableId)!
      expect(row.lengthWithSpare).toEqual(estimate.purchase)
      expect(row.lengthWithSpare).not.toEqual(estimate.run)
      expect(row.typeName).toBe('Cat6 UTP')
      expect(row.unestimatedReason).toBeNull()
      expect(row.note).toBeNull()
    }
    expect(rows.map((r) => r.label).sort()).toEqual(['F1_C1_F1_H1', 'F1_C2_F1_H1'])
  })

  it('row count always equals the floor\'s own cable count', () => {
    expect(buildProjectCableListRows(twoCableProject())).toHaveLength(2)
    const noCables = twoCableProject()
    noCables.floors[0].cables = []
    expect(buildProjectCableListRows(noCables)).toHaveLength(0)
  })
})

describe('buildProjectCableListRows - the spare percent', () => {
  it.each([0, 15, 25])('wastePercent %i: length follows the live setting (0 = equals run); header reflects it; no literal 15 in the source', (wastePercent) => {
    const project = twoCableProject({ wastePercent })
    const rows = buildProjectCableListRows(project)
    const run = computeProjectCableEstimate(asFullProject(project)).byFloorId.get('f1')!.byCableId.get('c1')!.run.nominal
    const expected = wastePercent === 0 ? run : run * (1 + wastePercent / 100)
    expect(rows.find((r) => r.cableId === 'c1')!.lengthWithSpare!.nominal).toBeCloseTo(expected, 6)

    const table = cableListToCsvTable(rows, wastePercent)
    expect(table[0][2]).toBe(`Length (+${wastePercent}% spare) (m)`)
  })
})

describe('cableListToCsvTable', () => {
  it('header cells exactly Cable/Type/Length/Notes; 4 cells per row; no price cell', () => {
    const rows = buildProjectCableListRows(twoCableProject())
    const table = cableListToCsvTable(rows, 15)
    expect(table[0]).toEqual(['Cable', 'Type', 'Length (+15% spare) (m)', 'Notes'])
    for (const row of table.slice(1)) expect(row).toHaveLength(4)
  })
})

describe('buildProjectCableListRows - floor with no scale', () => {
  it('every row reads the scale reason, length null, and an empty CSV length cell', () => {
    const project = twoCableProject()
    const noScale: CableListProject = { ...project, floors: [{ ...project.floors[0], scale: null }] }
    const rows = buildProjectCableListRows(noScale)
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.unestimatedReason).toBe('floor has no scale set')
      expect(row.lengthWithSpare).toBeNull()
    }
    const table = cableListToCsvTable(rows, 15)
    for (const row of table.slice(1)) expect(row[2]).toBe('')
  })
})

describe('buildProjectCableListRows - cross-floor exclusions', () => {
  it('linked-floor-scale-not-set: named reason, but the real final end label', () => {
    const project = twoFloorLinkedProject({ floor1: { scale: null } })
    const rows = buildProjectCableListRows(project)
    const row = rows.find((r) => r.cableId === CROSS_FLOOR_CABLE.id)!
    expect(row.unestimatedReason).toBe('a linked floor has no scale set')
    expect(row.label).toBe('F1_C1_F2_H1')
    expect(row.lengthWithSpare).toBeNull()
  })

  it('link-cycle: named reason, open-end label', () => {
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
    const rows = buildProjectCableListRows(project)
    const row = rows.find((r) => r.cableId === CROSS_FLOOR_CABLE.id)!
    expect(row.unestimatedReason).toBe('its cross-floor route forms a cycle')
    expect(row.label).toBe('F1_C1_?')
  })
})

describe('buildProjectCableListRows - a cable through a shaft', () => {
  const cam1 = cam('cam-c1')
  const cam2 = cam('cam-c2')

  it('not routed: still estimated (up to the shaft) + a note; label ends in "?"', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2')] }])
    const row = buildProjectCableListRows(project).find((r) => r.cableId === 'c1')!
    expect(row.label).toBe('F2_C1_?')
    expect(row.lengthWithSpare).not.toBeNull()
    expect(row.unestimatedReason).toBeNull()
    expect(row.note).toBe('not routed beyond its shaft - counted up to the shaft only')
  })

  it('routed to a hub: estimated, no note', () => {
    const project = shaftFourFloorProject([{}, { cameras: [cam1], cables: [shaftCable('c1', 'sm2', 'sf0')] }])
    const row = buildProjectCableListRows(project).find((r) => r.cableId === 'c1')!
    expect(row.label).toBe('F2_C1_F1_H1')
    expect(row.note).toBeNull()
    expect(row.lengthWithSpare).not.toBeNull()
  })

  it('routed to a fire-alarm device on another floor (with the catalog lookup): designator label, no note', () => {
    const panel = { id: 'fa-1', modelId: 'panel', x: 100, y: 200 }
    const cable: Cable = { ...shaftCable('c2', 'sm2'), beyondShaft: { floorId: 'sf2', points: [], endDevice: { kind: 'fire-alarm', id: 'fa-1' } } }
    const project = shaftFourFloorProject([{}, { cameras: [cam2], cables: [cable] }, { fireAlarmDevices: [panel] }])
    const row = buildProjectCableListRows(project, { fireAlarmModelById: { panel: { kind: 'control-panel' } } }).find((r) => r.cableId === 'c2')!
    expect(row.label).toBe('F2_C1_F3_P1')
    expect(row.note).toBeNull()
  })
})

describe('buildProjectCableListRows - device-to-device and fire-alarm starts', () => {
  it('device-to-device cable: F1_C1_F1_C2, length from the estimate', () => {
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-2' }, typeId: 'cat6-utp', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1'), cam('cam-2')], cables: [cable] })
    const project: CableListProject = { floors: [floor], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
    const row = buildProjectCableListRows(project)[0]
    expect(row.label).toBe('F1_C1_F1_C2')
    expect(row.lengthWithSpare).not.toBeNull()
  })

  it('a fire-alarm start, with the catalog lookup: F1_P1_F1_H1', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const panel = { id: 'fa-1', modelId: 'panel', x: 0, y: 0 }
    const cable: Cable = { id: 'c1', device: { kind: 'fire-alarm', id: 'fa-1' }, hubId: 'h1', typeId: 'cat6-utp', points: [] }
    const floor = floorWith('f1', 'Floor 1', { fireAlarmDevices: [panel], hubs: [hub], cables: [cable] })
    const project: CableListProject = { floors: [floor], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
    const row = buildProjectCableListRows(project, { fireAlarmModelById: { panel: { kind: 'control-panel' } } })[0]
    expect(row.label).toBe('F1_P1_F1_H1')
  })
})

describe('buildProjectCableListRows - the floorId option', () => {
  function twoIndependentFloorsProject(): CableListProject {
    const floor1 = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [{ id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }], cables: [{ id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 'cat6-utp', points: [] }] })
    const floor2 = floorWith('f2', 'Floor 2', { cameras: [cam('cam-2')], hubs: [{ id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }], cables: [{ id: 'c2', device: { kind: 'camera', id: 'cam-2' }, hubId: 'h1', typeId: 'cat6-utp', points: [] }] })
    return { floors: [floor1, floor2], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
  }

  it('omitted: every floor, in floor order; given: that floor only, same label either way', () => {
    const project = twoIndependentFloorsProject()
    const all = buildProjectCableListRows(project)
    expect(all.map((r) => r.cableId)).toEqual(['c1', 'c2'])

    const floor2Only = buildProjectCableListRows(project, { floorId: 'f2' })
    expect(floor2Only.map((r) => r.cableId)).toEqual(['c2'])
    expect(floor2Only[0].label).toBe(all.find((r) => r.cableId === 'c2')!.label)
  })
})

describe('buildProjectCableListRows - duplicate labels', () => {
  it('two cables from the same camera to the same hub: two rows, same label, different cableId', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cables: Cable[] = [
      { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 'cat6-utp', points: [] },
      { id: 'c2', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 'cat6-utp', points: [] },
    ]
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables })
    const project: CableListProject = { floors: [floor], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
    const rows = buildProjectCableListRows(project)
    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe(rows[1].label)
    expect(rows[0].cableId).not.toBe(rows[1].cableId)
  })
})

describe('buildProjectCableListRows - unknown type and dangling reasons', () => {
  it('a cable whose type no longer exists: "unknown cable type", never guessed', () => {
    const hub: Hub = { id: 'h1', x: 0, y: 0, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', typeId: 'gone-type', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], hubs: [hub], cables: [cable] })
    const project: CableListProject = { floors: [floor], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
    const row = buildProjectCableListRows(project)[0]
    expect(row.unestimatedReason).toBe('unknown cable type')
    expect(row.lengthWithSpare).toBeNull()
  })

  it('a cable that lost its end hub: "lost its start or end"', () => {
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'gone', typeId: 'cat6-utp', points: [] }
    const floor = floorWith('f1', 'Floor 1', { cameras: [cam('cam-1')], cables: [cable] })
    const project: CableListProject = { floors: [floor], shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS } }
    const row = buildProjectCableListRows(project)[0]
    expect(row.unestimatedReason).toBe('lost its start or end')
    expect(row.lengthWithSpare).toBeNull()
  })
})
