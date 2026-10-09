import { describe, expect, it } from 'vitest'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from './project-file-schema'
import { buildLegacyFlatRaw, buildProject, onlyFloor } from './project-file-test-fixtures'

const KNOWN_FIRE_ALARM_MODEL_IDS = new Set(['panel-1', 'smoke-1'])
const LOOKUPS: ProjectFileLookups = {
  cameraModelIds: new Set(),
  sensorModelLookup: new Map(),
  fireAlarmModelIds: KNOWN_FIRE_ALARM_MODEL_IDS,
}

const panel: PlacedFireAlarmDevice = { id: 'f1', modelId: 'panel-1', x: 10, y: 10 }
const smoke: PlacedFireAlarmDevice = { id: 'f2', modelId: 'smoke-1', x: 50, y: 60 }

function projectWith(fireAlarmDevices: PlacedFireAlarmDevice[]) {
  return buildProject({ fireAlarmDevices })
}

function parse(project: ReturnType<typeof projectWith>) {
  return parseProjectFile(serializeProject(project), LOOKUPS)
}

type Raw = { floors: Array<Record<string, unknown>> } & Record<string, unknown>

function parseRaw(mutate: (raw: Raw) => void) {
  const raw = JSON.parse(serializeProject(projectWith([]))) as Raw
  mutate(raw)
  return parseProjectFile(JSON.stringify(raw), LOOKUPS)
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

describe('project file fire-alarm devices - back-compat', () => {
  it.each([1, 2, 3, 4, 5])('loads a legacy version %i file without fireAlarmDevices/fireAlarmSettings with the defaults', (version) => {
    const raw = buildLegacyFlatRaw(version)
    const result = expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))
    expect(onlyFloor(result).fireAlarmDevices).toEqual([])
    expect(result.project.fireAlarmSettings).toEqual({ coverageMode: 'datasheet', ceilingHeightM: null })
    expect(result.warnings).toEqual([])
  })
})

describe('project file fire-alarm devices - round trip', () => {
  it('preserves devices and settings exactly, with no warnings', () => {
    const project = projectWith([panel, smoke])
    const result = expectOk(parse(project))
    expect(result.project).toEqual(project)
    expect(result.warnings).toEqual([])
  })

  it('round-trips the tcvn-5738 coverage mode with a ceiling height', () => {
    const project = buildProject(
      { fireAlarmDevices: [panel] },
      { fireAlarmSettings: { coverageMode: 'tcvn-5738', ceilingHeightM: 3.5 } },
    )
    const result = expectOk(parse(project))
    expect(result.project.fireAlarmSettings).toEqual({ coverageMode: 'tcvn-5738', ceilingHeightM: 3.5 })
  })

  it('writes schemaVersion 8', () => {
    expect(JSON.parse(serializeProject(projectWith([panel]))).schemaVersion).toBe(8)
  })
})

describe('project file fire-alarm devices - normalisation warnings', () => {
  it('drops a device referencing an unknown modelId, with a warning', () => {
    const result = expectOk(parseRaw((raw) => void (raw.floors[0].fireAlarmDevices = [{ id: 'f1', modelId: 'does-not-exist', x: 0, y: 0 }])))
    expect(onlyFloor(result).fireAlarmDevices).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('does-not-exist')
  })

  it('drops a repeated id, keeping the first', () => {
    const result = expectOk(parseRaw((raw) => void (raw.floors[0].fireAlarmDevices = [panel, { ...panel, x: 999 }])))
    expect(onlyFloor(result).fireAlarmDevices).toEqual([panel])
    expect(result.warnings).toHaveLength(1)
  })
})

describe('project file fire-alarm devices - rejected input', () => {
  it('rejects an unknown key on a device', () => {
    expect(parseRaw((raw) => void (raw.floors[0].fireAlarmDevices = [{ ...panel, extra: 1 }])).ok).toBe(false)
  })

  it('rejects more than MAX_FIRE_ALARM_DEVICES devices', () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ id: `f${i}`, modelId: 'panel-1', x: i, y: i }))
    expect(parseRaw((raw) => void (raw.floors[0].fireAlarmDevices = many)).ok).toBe(false)
  })

  it('rejects an unknown coverageMode', () => {
    expect(parseRaw((raw) => void (raw.fireAlarmSettings = { coverageMode: 'nfpa-72', ceilingHeightM: null })).ok).toBe(false)
  })

  it('rejects a ceilingHeightM of 0 or beyond CEILING_HEIGHT_MAX_M', () => {
    expect(parseRaw((raw) => void (raw.fireAlarmSettings = { coverageMode: 'tcvn-5738', ceilingHeightM: 0 })).ok).toBe(false)
    expect(parseRaw((raw) => void (raw.fireAlarmSettings = { coverageMode: 'tcvn-5738', ceilingHeightM: 12.1 })).ok).toBe(false)
  })

  it('rejects schemaVersion 9', () => {
    expect(parseRaw((raw) => void (raw.schemaVersion = 9)).ok).toBe(false)
  })
})
