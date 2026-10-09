import { describe, expect, it } from 'vitest'
import { createDefaultCableTypes } from '../cable/cable-layout-types'
import { DEFAULT_FLOOR_HEIGHT_M, type Floor } from '../floor/floor-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from './project-file-schema'
import { buildFloor, buildLegacyFlatRaw, buildProject, buildProjectWithFloors, onlyFloor } from './project-file-test-fixtures'
import type { Project } from './project-types'

const LOOKUPS: ProjectFileLookups = {
  cameraModelIds: new Set(['model-a']),
  sensorModelLookup: new Map([['pir-1', { shape: 'sector' }]]),
  fireAlarmModelIds: new Set(['panel-1']),
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

/** Asserts rejection and, when given, that the error names the refine that caused it. */
function expectRejected(raw: unknown, errorContains?: string) {
  const result = parseProjectFile(JSON.stringify(raw), LOOKUPS)
  expect(result.ok).toBe(false)
  if (errorContains && !result.ok) expect(result.error).toContain(errorContains)
}

describe('legacy flat fixtures - each wraps into one floor, data kept', () => {
  it('v1: image + cameras only', () => {
    const raw = buildLegacyFlatRaw(1, { cameras: [{ id: 'cam-1', modelId: 'model-a', x: 1, y: 2, rotationDeg: 0, rangeM: 10 }] })
    const floor = onlyFloor(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS)))
    expect(floor.cameras).toEqual(raw.cameras)
    expect(floor.id).toBe('floor-1')
    expect(floor.floorHeightM).toBe(DEFAULT_FLOOR_HEIGHT_M)
  })

  it('v2: camera mount height + tilt kept', () => {
    const raw = buildLegacyFlatRaw(2, {
      cameras: [{ id: 'cam-1', modelId: 'model-a', x: 1, y: 2, rotationDeg: 0, rangeM: 10, mountHeightM: 3, tiltDeg: 20 }],
    })
    const floor = onlyFloor(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS)))
    expect(floor.cameras[0]).toMatchObject({ mountHeightM: 3, tiltDeg: 20 })
  })

  it('v3: walls kept', () => {
    const raw = buildLegacyFlatRaw(3, { walls: [{ id: 'w1', kind: 'opaque', x1: 0, y1: 0, x2: 50, y2: 0 }] })
    const floor = onlyFloor(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS)))
    expect(floor.walls).toEqual(raw.walls)
  })

  it('v4: sensors kept', () => {
    const raw = buildLegacyFlatRaw(4, { sensors: [{ id: 's1', modelId: 'pir-1', shape: 'sector', x: 5, y: 5, rotationDeg: 0, rangeM: 8 }] })
    const floor = onlyFloor(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS)))
    expect(floor.sensors).toEqual(raw.sensors)
  })

  it('v5: hubs + cables kept', () => {
    const raw = buildLegacyFlatRaw(5, {
      cameras: [{ id: 'cam-1', modelId: 'model-a', x: 1, y: 2, rotationDeg: 0, rangeM: 10 }],
      hubs: [{ id: 'hub-1', x: 10, y: 10, mountHeightM: 1.5 }],
      cables: [{ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }],
    })
    const result = expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))
    const floor = onlyFloor(result)
    expect(floor.hubs).toEqual(raw.hubs)
    expect(floor.cables).toEqual(raw.cables)
  })

  it('v6: fireAlarmDevices become the floor\'s, fireAlarmSettings become the project\'s', () => {
    const raw = buildLegacyFlatRaw(6, {
      fireAlarmDevices: [{ id: 'f1', modelId: 'panel-1', x: 3, y: 4 }],
      fireAlarmSettings: { coverageMode: 'tcvn-5738', ceilingHeightM: 3 },
    })
    const result = expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))
    const floor = onlyFloor(result)
    expect(floor.fireAlarmDevices).toEqual(raw.fireAlarmDevices)
    expect(result.project.fireAlarmSettings).toEqual(raw.fireAlarmSettings)
  })
})

describe('v7 round trip', () => {
  it('deep-equals a 3-floor project (one floor without an image)', () => {
    const project: Project = buildProjectWithFloors([
      buildFloor({ id: 'floor-1', name: 'Ground', cameras: [{ id: 'cam-1', modelId: 'model-a', x: 1, y: 1, rotationDeg: 0, rangeM: 10 }] }),
      buildFloor({ id: 'floor-2', name: 'First', floorHeightM: 4, image: null, scale: null }),
      buildFloor({ id: 'floor-3', name: 'Second', sensors: [{ id: 's1', modelId: 'pir-1', shape: 'sector', x: 2, y: 2, rotationDeg: 0, rangeM: 5 }] }),
    ])
    const result = expectOk(parseProjectFile(serializeProject(project), LOOKUPS))
    expect(result.project).toEqual(project)
    expect(result.warnings).toEqual([])
  })
})

describe('v7 rejections', () => {
  const okFloor = buildFloor()

  it('rejects 0 floors', () => {
    const project = buildProject()
    const raw = JSON.parse(serializeProject(project))
    raw.floors = []
    expectRejected(raw)
  })

  it('rejects 21 floors', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.floors = Array.from({ length: 21 }, (_, i) => ({ ...okFloor, id: `floor-${i}`, name: `Floor ${i}` }))
    expectRejected(raw)
  })

  it('rejects a duplicate floor id', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.floors = [okFloor, { ...okFloor, name: 'Floor 1 again' }]
    expectRejected(raw)
  })

  it('rejects an empty floor name', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.floors = [{ ...okFloor, name: '' }]
    expectRejected(raw)
  })

  it('rejects when no floor has an image', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.floors = [{ ...okFloor, image: null, scale: null, cameras: [], walls: [], sensors: [], hubs: [], cables: [], fireAlarmDevices: [] }]
    expectRejected(raw)
  })

  it('rejects schemaVersion 10 (future)', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.schemaVersion = 10
    expectRejected(raw)
  })

  it('rejects an unknown top-level key', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.extra = 1
    expectRejected(raw)
  })
})

describe('v7 rejections - an image-less floor must have no scale or placed items', () => {
  // Two floors, floor 0 WITH an image - otherwise "no floor has an image" rejects it for a
  // different reason and the image-less refine itself is never exercised.
  const REFINE_ERROR = 'must have no scale, cameras, walls, sensors, hubs, cables or fire-alarm devices'

  it.each<[string, Partial<Floor>]>([
    ['scale', { scale: { planPxPerMeter: 50, refLine: { x1: 0, y1: 0, x2: 10, y2: 0 }, refLengthM: 1 } }],
    ['cameras', { cameras: [{ id: 'c1', modelId: 'model-a', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }] }],
    ['walls', { walls: [{ id: 'w1', kind: 'opaque', x1: 0, y1: 0, x2: 10, y2: 0 }] }],
    ['sensors', { sensors: [{ id: 's1', modelId: 'pir-1', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 5 }] }],
    ['hubs', { hubs: [{ id: 'hub-1', x: 0, y: 0, mountHeightM: 1.5 }] }],
    ['cables', { cables: [{ id: 'cable-1', device: { kind: 'camera', id: 'c1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }] }],
    ['fireAlarmDevices', { fireAlarmDevices: [{ id: 'f1', modelId: 'panel-1', x: 0, y: 0 }] }],
  ])('rejects an image-less floor 1 with %s, while floor 0 has an image', (_field, patch) => {
    const floor0 = buildFloor({ id: 'floor-1', name: 'Ground' })
    const floor1 = buildFloor({ id: 'floor-2', name: 'Roof', image: null, scale: null, ...patch })
    const raw = JSON.parse(serializeProject(buildProjectWithFloors([floor0, floor1])))
    expectRejected(raw, REFINE_ERROR)
  })
})

describe('multi-floor warning prefix', () => {
  it('prefixes a floor\'s warning with its name only when the file has more than one floor', () => {
    const raw = JSON.parse(
      serializeProject(
        buildProjectWithFloors([buildFloor({ name: 'Ground' }), buildFloor({ id: 'floor-2', name: 'Roof', image: null, scale: null })]),
      ),
    )
    raw.floors[0].cameras.push({ id: 'cam-bad', modelId: 'does-not-exist', x: 0, y: 0, rotationDeg: 0, rangeM: 10 })
    const result = expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))
    expect(result.warnings).toEqual(['Ground: Camera "cam-bad" references unknown model "does-not-exist"; dropped.'])
  })

  it('does not prefix a single-floor file\'s warning', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.floors[0].cameras.push({ id: 'cam-bad', modelId: 'does-not-exist', x: 0, y: 0, rotationDeg: 0, rangeM: 10 })
    const result = expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))
    expect(result.warnings).toEqual(['Camera "cam-bad" references unknown model "does-not-exist"; dropped.'])
  })
})

describe('warning order - single-floor file matches the pre-multi-floor order', () => {
  it('orders camera, then cable-type, then hub warnings exactly as before splitting cable types out', () => {
    const types = createDefaultCableTypes()
    const raw = buildLegacyFlatRaw(6, {
      cameras: [{ id: 'cam-1', modelId: 'does-not-exist', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }],
      hubs: [
        { id: 'hub-1', x: 0, y: 0, mountHeightM: 1 },
        { id: 'hub-1', x: 5, y: 5, mountHeightM: 1 },
      ],
      cableTypes: [...types, { ...types[0], name: 'Twin' }],
    })
    const result = parseProjectFile(JSON.stringify(raw), LOOKUPS)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.warnings).toEqual([
      'Camera "cam-1" references unknown model "does-not-exist"; dropped.',
      `Cable type id "${types[0].id}" is used more than once; the repeat was dropped.`,
      'Hub id "hub-1" is used more than once; the repeat was dropped.',
    ])
  })
})

describe('floorHeightM', () => {
  it('defaults to 3.5 when missing from a v7 floor', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    delete raw.floors[0].floorHeightM
    expect(onlyFloor(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))).floorHeightM).toBe(3.5)
  })

  it('defaults to 3.5 for a legacy (pre-v7) file', () => {
    const raw = buildLegacyFlatRaw(1)
    expect(onlyFloor(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))).floorHeightM).toBe(3.5)
  })

  it('rejects 0.4 and 31', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.floors[0].floorHeightM = 0.4
    expectRejected(raw)
    raw.floors[0].floorHeightM = 31
    expectRejected(raw)
  })

  it('round-trips a typed value', () => {
    const project = buildProject({ floorHeightM: 4.2 })
    const result = expectOk(parseProjectFile(serializeProject(project), LOOKUPS))
    expect(onlyFloor(result).floorHeightM).toBe(4.2)
  })
})

describe('shafts', () => {
  it('defaults to [] when missing', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    delete raw.shafts
    expect(expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS)).project.shafts).toEqual([])
  })

  it('rejects a duplicate shaft id', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.shafts = [{ id: 't1', name: 'Shaft 1' }, { id: 't1', name: 'Shaft 1 again' }]
    expectRejected(raw)
  })

  it('rejects 21 shafts', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.shafts = Array.from({ length: 21 }, (_, i) => ({ id: `t${i}`, name: `Shaft ${i}` }))
    expectRejected(raw)
  })

  it('rejects an empty shaft name', () => {
    const raw = JSON.parse(serializeProject(buildProject()))
    raw.shafts = [{ id: 't1', name: '' }]
    expectRejected(raw)
  })

  it('round-trips a typed shaft list that has a marker (phase 6: a markerless shaft is pruned - see project-file-schema-shafts.test.ts)', () => {
    const project = buildProject(
      { hubs: [{ id: 'm1', kind: 'shaft', shaftId: 't1', x: 1, y: 1, mountHeightM: 0 }] },
      { shafts: [{ id: 't1', name: 'Main shaft' }] },
    )
    const result = expectOk(parseProjectFile(serializeProject(project), LOOKUPS))
    expect(result.project.shafts).toEqual([{ id: 't1', name: 'Main shaft' }])
  })
})
