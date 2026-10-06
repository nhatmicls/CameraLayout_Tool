import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProject, type SensorModelLookup } from './project-file-schema'
import type { Project } from './project-types'
import type { PlacedBeamSensor, PlacedCircleSensor, PlacedSectorSensor } from '../sensor/sensor-types'

// Smallest possible valid PNG (1x1 transparent pixel), as a real base64 data URL.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAk6WgQAAAABJRU5ErkJggg=='

const KNOWN_MODEL_IDS = new Set(['model-a'])

const SENSOR_MODEL_LOOKUP: SensorModelLookup = new Map([
  ['pir-1', { shape: 'sector' }],
  ['thermal-1', { shape: 'sector' }],
  ['vib-1', { shape: 'circle' }],
  ['beam-1', { shape: 'beam', defaultBeamEnvironment: 'indoor' }],
  ['beam-2', { shape: 'beam', defaultBeamEnvironment: 'outdoor' }],
])

const sector: PlacedSectorSensor = { id: 'sec-1', modelId: 'pir-1', shape: 'sector', x: 10, y: 10, rotationDeg: 0, rangeM: 12 }
const circle: PlacedCircleSensor = { id: 'cir-1', modelId: 'vib-1', shape: 'circle', x: 20, y: 20, radiusM: 6 }
const beam: PlacedBeamSensor = {
  id: 'beam-s1',
  modelId: 'beam-1',
  shape: 'beam',
  x: 0,
  y: 0,
  x2: 100,
  y2: 0,
  environment: 'outdoor',
}

function projectWith(sensors: Project['sensors']): Project {
  return {
    image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 1000, heightPx: 800, fileName: 'floor-plan.png' },
    scale: null,
    cameras: [],
    walls: [],
    sensors,
  }
}

function parse(project: Project) {
  return parseProjectFile(serializeProject(project), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
}

function parseRaw(sensors: unknown, mutate: (raw: Record<string, unknown>) => void = () => {}) {
  const raw = JSON.parse(serializeProject(projectWith([]))) as Record<string, unknown>
  raw.sensors = sensors
  mutate(raw)
  return parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

describe('project file sensors - back-compat', () => {
  it.each([1, 2, 3])('loads a version %i file without `sensors` as an empty sensor list', (version) => {
    const result = expectOk(
      parseRaw(undefined, (raw) => {
        delete raw.sensors
        raw.schemaVersion = version
      }),
    )
    expect(result.project.sensors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('accepts `sensors: []`', () => {
    expect(expectOk(parseRaw([])).project.sensors).toEqual([])
  })
})

describe('project file sensors - v4 round trip per shape', () => {
  it('preserves a sector sensor exactly', () => {
    const project = projectWith([sector])
    const result = expectOk(parse(project))
    expect(result.project).toEqual(project)
    expect(result.warnings).toEqual([])
  })

  it('preserves a sector sensor with an angleDeg override', () => {
    const withOverride: PlacedSectorSensor = { ...sector, angleDeg: 45 }
    const result = expectOk(parse(projectWith([withOverride])))
    expect(result.project.sensors).toEqual([withOverride])
  })

  it('preserves a circle sensor exactly', () => {
    const project = projectWith([circle])
    const result = expectOk(parse(project))
    expect(result.project).toEqual(project)
  })

  it('preserves a beam sensor (with explicit environment) exactly', () => {
    const project = projectWith([beam])
    const result = expectOk(parse(project))
    expect(result.project).toEqual(project)
  })

  it('writes schemaVersion 4', () => {
    expect(JSON.parse(serializeProject(projectWith([sector]))).schemaVersion).toBe(4)
  })
})

describe('project file sensors - beam environment default on load', () => {
  it('fills the model default when the file omits environment', () => {
    const raw = JSON.parse(serializeProject(projectWith([beam]))) as { sensors: Array<Record<string, unknown>> }
    delete raw.sensors[0].environment
    const result = expectOk(parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP))
    expect(result.project.sensors[0]).toMatchObject({ environment: 'indoor' })
  })

  it("uses the model's outdoor default when that is the smaller figure", () => {
    const outdoorDefaultBeam: PlacedBeamSensor = { ...beam, id: 'beam-s2', modelId: 'beam-2' }
    const raw = JSON.parse(serializeProject(projectWith([outdoorDefaultBeam]))) as { sensors: Array<Record<string, unknown>> }
    delete raw.sensors[0].environment
    const result = expectOk(parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP))
    expect(result.project.sensors[0]).toMatchObject({ environment: 'outdoor' })
  })
})

describe('project file sensors - rejected input', () => {
  it('rejects an unknown shape literal', () => {
    expect(parseRaw([{ ...sector, shape: 'triangle' }]).ok).toBe(false)
  })

  it('rejects a strict-key violation (extra key on a sensor)', () => {
    expect(parseRaw([{ ...sector, extra: 'nope' }]).ok).toBe(false)
  })

  it('rejects a sector rangeM of 0 or negative', () => {
    expect(parseRaw([{ ...sector, rangeM: 0 }]).ok).toBe(false)
    expect(parseRaw([{ ...sector, rangeM: -5 }]).ok).toBe(false)
  })

  // modelId needs its own length cap (id already has one) - a hand-edited file could
  // otherwise carry an arbitrarily long modelId string.
  it('rejects a modelId longer than 100 characters', () => {
    expect(parseRaw([{ ...sector, modelId: 'x'.repeat(101) }]).ok).toBe(false)
  })

  it('still accepts a modelId at exactly 100 characters (schema boundary, not a day-to-day id)', () => {
    const longButValidId = `pir-1${'x'.repeat(95)}` // 100 chars, not in SENSOR_MODEL_LOOKUP
    const result = expectOk(parseRaw([{ ...sector, modelId: longButValidId }]))
    // Schema accepts the length; normalisation still drops it as an unknown model, with a warning.
    expect(result.project.sensors).toEqual([])
    expect(result.warnings).toHaveLength(1)
  })

  it('rejects more than MAX_SENSORS sensors', () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ ...sector, id: `sec-${i}` }))
    expect(parseRaw(many).ok).toBe(false)
  })

  it('rejects an unknown/future schemaVersion', () => {
    const raw = JSON.parse(serializeProject(projectWith([]))) as Record<string, unknown>
    raw.schemaVersion = 5
    expect(parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP).ok).toBe(false)
  })
})

describe('project file sensors - normalisation warnings', () => {
  it('drops a sensor referencing an unknown modelId, with a warning', () => {
    const result = expectOk(parseRaw([{ ...sector, modelId: 'does-not-exist' }]))
    expect(result.project.sensors).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('does-not-exist')
  })

  it("drops a sensor whose shape does not match its model's catalog shape", () => {
    const result = expectOk(parseRaw([{ ...circle, modelId: 'pir-1', shape: 'circle' }]))
    expect(result.project.sensors).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('pir-1')
  })

  it('drops a repeated sensor id, keeping the first', () => {
    const second = { ...sector, x: 999 }
    const result = expectOk(parseRaw([sector, second]))
    expect(result.project.sensors).toEqual([sector])
    expect(result.warnings).toHaveLength(1)
  })

  it('drops a zero-length beam with a warning', () => {
    const zeroLength = { ...beam, x2: beam.x, y2: beam.y }
    const result = expectOk(parseRaw([zeroLength]))
    expect(result.project.sensors).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('beam-s1')
  })
})
