import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CABLE_SETTINGS,
  createDefaultCableTypes,
  type Cable,
  type Hub,
} from '../cable/cable-layout-types'
import type { PlacedBeamSensor, PlacedSectorSensor } from '../sensor/sensor-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups, type SensorModelLookup } from './project-file-schema'
import { buildProject, onlyFloor } from './project-file-test-fixtures'

const KNOWN_MODEL_IDS = new Set(['model-a'])
const SENSOR_MODEL_LOOKUP: SensorModelLookup = new Map([
  ['pir-1', { shape: 'sector' }],
  ['beam-1', { shape: 'beam', defaultBeamEnvironment: 'indoor' }],
])
const LOOKUPS: ProjectFileLookups = {
  cameraModelIds: KNOWN_MODEL_IDS,
  sensorModelLookup: SENSOR_MODEL_LOOKUP,
  fireAlarmModelIds: new Set(),
}

const pir: PlacedSectorSensor = { id: 'pir-s1', modelId: 'pir-1', shape: 'sector', x: 10, y: 10, rotationDeg: 0, rangeM: 12 }
const beam: PlacedBeamSensor = { id: 'beam-s1', modelId: 'beam-1', shape: 'beam', x: 0, y: 0, x2: 100, y2: 0, environment: 'indoor' }
const hub: Hub = { id: 'hub-1', x: 700, y: 500, mountHeightM: 1.5 }
const cameraCable: Cable = {
  id: 'cable-1',
  device: { kind: 'camera', id: 'cam-1' },
  hubId: 'hub-1',
  typeId: 'cat6-utp',
  points: [
    { x: 400, y: 100 },
    { x: 400, y: 500 },
  ],
}
const beamRxCable: Cable = {
  id: 'cable-2',
  device: { kind: 'sensor', id: 'beam-s1', end: 'rx' },
  hubId: 'hub-1',
  typeId: 'alarm-signal',
  points: [],
}

const project = buildProject({
  cameras: [{ id: 'cam-1', modelId: 'model-a', x: 100, y: 100, rotationDeg: 0, rangeM: 15 }],
  sensors: [pir, beam],
  hubs: [hub],
  cables: [cameraCable, beamRxCable],
})

type Raw = Record<string, unknown> & { floors: Array<Record<string, unknown> & { hubs: Hub[]; cables: Cable[]; cameras: Array<Record<string, unknown>> }> }

function parseRaw(mutate: (raw: Raw) => void) {
  const raw = JSON.parse(serializeProject(project)) as Raw
  mutate(raw)
  return parseProjectFile(JSON.stringify(raw), LOOKUPS)
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

describe('project file cables - round trip and back-compat', () => {
  it('round-trips a v7 project deep-equal with no warnings', () => {
    const result = expectOk(parseRaw(() => {}))
    expect(result.project).toEqual(project)
    expect(result.warnings).toEqual([])
  })

  it('round-trips a riser and a drop, and rejects any other hub kind or an out-of-range length', () => {
    const riser: Hub = { id: 'riser-1', kind: 'riser', x: 50, y: 60, mountHeightM: 6, extraLengthM: 12.5 }
    const drop: Hub = { id: 'drop-1', kind: 'drop', x: 70, y: 60, mountHeightM: 2 }
    expect(expectOk(parseRaw((raw) => void raw.floors[0].hubs.push(riser, drop))).project.floors[0].hubs).toEqual([hub, riser, drop])
    expect(parseRaw((raw) => void raw.floors[0].hubs.push({ ...riser, kind: 'lift' } as unknown as Hub)).ok).toBe(false)
    expect(parseRaw((raw) => void raw.floors[0].hubs.push({ ...riser, extraLengthM: 501 })).ok).toBe(false)
    expect(parseRaw((raw) => void raw.floors[0].hubs.push({ ...drop, mountHeightM: -1 })).ok).toBe(false)
  })

  it.each([1, 2, 3, 4])('loads a legacy flat version %i file without cable keys with the defaults', (version) => {
    const rawFloor = project.floors[0]
    const legacy = {
      app: 'camera-layout-tool',
      schemaVersion: version,
      image: rawFloor.image,
      scale: rawFloor.scale,
      cameras: rawFloor.cameras,
      sensors: rawFloor.sensors,
    }
    const result = expectOk(parseProjectFile(JSON.stringify(legacy), LOOKUPS))
    const floor = onlyFloor(result)
    expect(floor.hubs).toEqual([])
    expect(floor.cables).toEqual([])
    expect(result.project.cableTypes).toEqual(createDefaultCableTypes())
    expect(result.project.cableSettings).toEqual(DEFAULT_CABLE_SETTINGS)
    expect(result.warnings).toEqual([])
  })

  it('rejects schemaVersion 8', () => {
    expect(parseRaw((raw) => void (raw.schemaVersion = 8)).ok).toBe(false)
  })

  it('reseeds the default types when the file carries an empty list', () => {
    const result = expectOk(
      parseRaw((raw) => {
        raw.cableTypes = []
        raw.floors[0].cables = []
      }),
    )
    expect(result.project.cableTypes).toEqual(createDefaultCableTypes())
  })

  it('dedupes a repeated cable type id once, not once per floor', () => {
    const types = createDefaultCableTypes()
    const secondFloor = { ...project.floors[0], id: 'floor-2', name: 'Floor 2' }
    const result = expectOk(
      parseRaw((raw) => {
        raw.floors.push(secondFloor as unknown as Raw['floors'][number])
        raw.cableTypes = [...types, { ...types[0], name: 'Twin' }]
      }),
    )
    expect(result.project.cableTypes).toEqual(types)
    expect(result.warnings).toHaveLength(1)
  })

  it('allows the same hub id on different floors (hubs are per-floor, not global)', () => {
    const secondFloor = { ...project.floors[0], id: 'floor-2', name: 'Floor 2' }
    const result = expectOk(
      parseRaw((raw) => {
        raw.floors.push(secondFloor as unknown as Raw['floors'][number])
      }),
    )
    expect(result.project.floors[0].hubs).toEqual([hub])
    expect(result.project.floors[1].hubs).toEqual([hub])
    expect(result.warnings).toEqual([])
  })
})

describe('project file cables - dropped with a warning, the rest kept', () => {
  function expectOnlyBeamCableKept(mutate: (raw: Raw) => void) {
    const result = expectOk(parseRaw(mutate))
    expect(onlyFloor(result).cables).toEqual([beamRxCable])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('cable-1')
  }

  it('unknown hubId', () => {
    expectOnlyBeamCableKept((raw) => void (raw.floors[0].cables[0].hubId = 'nope'))
  })

  it('unknown camera id', () => {
    expectOnlyBeamCableKept((raw) => void (raw.floors[0].cables[0].device = { kind: 'camera', id: 'nope' }))
  })

  it('unknown typeId', () => {
    expectOnlyBeamCableKept((raw) => void (raw.floors[0].cables[0].typeId = 'nope'))
  })

  it('beam ref without an end', () => {
    expectOnlyBeamCableKept((raw) => void (raw.floors[0].cables[0].device = { kind: 'sensor', id: 'beam-s1' }))
  })

  it('PIR ref with an end', () => {
    expectOnlyBeamCableKept((raw) => void (raw.floors[0].cables[0].device = { kind: 'sensor', id: 'pir-s1', end: 'tx' }))
  })

  it('a cable on a camera whose model is unknown (camera dropped first)', () => {
    const result = expectOk(parseRaw((raw) => void (raw.floors[0].cameras[0].modelId = 'does-not-exist')))
    const floor = onlyFloor(result)
    expect(floor.cameras).toEqual([])
    expect(floor.cables).toEqual([beamRxCable])
    expect(result.warnings).toHaveLength(2)
  })

  it('repeated hub id', () => {
    const result = expectOk(parseRaw((raw) => void raw.floors[0].hubs.push({ ...hub, x: 1 })))
    const floor = onlyFloor(result)
    expect(floor.hubs).toEqual([hub])
    expect(floor.cables).toHaveLength(2)
    expect(result.warnings).toHaveLength(1)
  })

  it('repeated cable id', () => {
    const result = expectOk(parseRaw((raw) => void raw.floors[0].cables.push({ ...beamRxCable, id: 'cable-1' })))
    expect(onlyFloor(result).cables).toEqual([cameraCable, beamRxCable])
    expect(result.warnings).toHaveLength(1)
  })

  it('repeated type id', () => {
    const types = createDefaultCableTypes()
    const result = expectOk(parseRaw((raw) => void (raw.cableTypes = [...types, { ...types[0], name: 'Twin' }])))
    expect(result.project.cableTypes).toEqual(types)
    expect(result.warnings).toHaveLength(1)
  })
})

describe('project file cables - rejected input', () => {
  const type = createDefaultCableTypes()[0]

  it.each<[string, (raw: Raw) => void]>([
    ['unknown key on a hub', (raw) => void (raw.floors[0].hubs[0] = { ...hub, extra: 1 } as Hub)],
    ['201 points', (raw) => void (raw.floors[0].cables[0].points = Array.from({ length: 201 }, (_, i) => ({ x: i, y: i })))],
    ['wastePercent 51', (raw) => void (raw.cableSettings = { ...DEFAULT_CABLE_SETTINGS, wastePercent: 51 })],
    ['price -1', (raw) => void (raw.cableTypes = [{ ...type, pricePerMeterVnd: -1 }])],
    ['price 1.5', (raw) => void (raw.cableTypes = [{ ...type, pricePerMeterVnd: 1.5 }])],
    ['61-char name', (raw) => void (raw.cableTypes = [{ ...type, name: 'x'.repeat(61) }])],
    ['lengthLimitM 0', (raw) => void (raw.cableTypes = [{ ...type, lengthLimitM: 0 }])],
    ['x 1e7', (raw) => void (raw.floors[0].hubs[0].x = 1e7)],
    ['hub height 31', (raw) => void (raw.floors[0].hubs[0].mountHeightM = 31)],
  ])('rejects %s', (_label, mutate) => {
    expect(parseRaw(mutate).ok).toBe(false)
  })
})
