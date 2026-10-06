import { describe, expect, it } from 'vitest'
import { parseProjectFile, serializeProject, type SensorModelLookup } from './project-file-schema'
import type { Project } from './project-types'

// Smallest possible valid PNG (1x1 transparent pixel), as a real base64 data URL.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAk6WgQAAAABJRU5ErkJggg=='

const baseProject: Project = {
  image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 1000, heightPx: 800, fileName: 'floor-plan.png' },
  scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 500, y2: 0 }, refLengthM: 5 },
  cameras: [{ id: 'cam-1', modelId: 'model-a', x: 10, y: 20, rotationDeg: 45, rangeM: 15 }],
  walls: [],
  sensors: [],
}

const KNOWN_MODEL_IDS = new Set(['model-a', 'model-b'])
const SENSOR_MODEL_LOOKUP: SensorModelLookup = new Map([
  ['sensor-a', { shape: 'sector' }],
  ['sensor-beam', { shape: 'beam', defaultBeamEnvironment: 'outdoor' }],
])

describe('serializeProject + parseProjectFile round trip', () => {
  it('round-trips deep-equal with no warnings', () => {
    const text = serializeProject(baseProject)
    const result = parseProjectFile(text, KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.project).toEqual(baseProject)
    expect(result.warnings).toEqual([])
  })

  it('round-trips a project with scale: null and no cameras', () => {
    const project: Project = { image: baseProject.image, scale: null, cameras: [], walls: [], sensors: [] }
    const result = parseProjectFile(serializeProject(project), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.project).toEqual(project)
  })
})

describe('schema version', () => {
  it('writes schemaVersion 4', () => {
    expect(JSON.parse(serializeProject(baseProject)).schemaVersion).toBe(4)
  })

  it('still reads a version 1 file, leaving cameras without mounting keys', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.schemaVersion = 1
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.project).toEqual(baseProject)
    expect(result.project.cameras[0]).not.toHaveProperty('mountHeightM')
    expect(result.project.cameras[0]).not.toHaveProperty('tiltDeg')
  })
})

describe('camera mounting height + tilt', () => {
  function parseWithCamera(patch: Record<string, unknown>) {
    const raw = JSON.parse(serializeProject(baseProject))
    Object.assign(raw.cameras[0], patch)
    return parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
  }

  it('round-trips both fields', () => {
    const project: Project = {
      ...baseProject,
      cameras: [{ ...baseProject.cameras[0], mountHeightM: 2.7, tiltDeg: 32 }],
    }
    const result = parseProjectFile(serializeProject(project), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.project).toEqual(project)
  })

  it('serialises a cleared camera without the keys', () => {
    const project: Project = {
      ...baseProject,
      cameras: [{ ...baseProject.cameras[0], mountHeightM: undefined, tiltDeg: undefined }],
    }
    const text = serializeProject(project)
    expect(text).not.toContain('mountHeightM')
    expect(text).not.toContain('tiltDeg')
    expect(parseProjectFile(text, KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP).ok).toBe(true)
  })

  it('accepts the range limits', () => {
    expect(parseWithCamera({ mountHeightM: 0.5, tiltDeg: 0 }).ok).toBe(true)
    expect(parseWithCamera({ mountHeightM: 30, tiltDeg: 90 }).ok).toBe(true)
  })

  it.each([
    [{ mountHeightM: 0.49, tiltDeg: 10 }],
    [{ mountHeightM: 30.01, tiltDeg: 10 }],
    [{ mountHeightM: 'NaN', tiltDeg: 10 }],
    [{ mountHeightM: 3, tiltDeg: -1 }],
    [{ mountHeightM: 3, tiltDeg: 90.5 }],
    [{ mountHeightM: 3 }],
    [{ tiltDeg: 10 }],
  ])('rejects %j', (patch) => {
    expect(parseWithCamera(patch).ok).toBe(false)
  })

  it('reports a half-set mounting with a readable path', () => {
    const result = parseWithCamera({ mountHeightM: 3 })
    if (result.ok) throw new Error('expected rejection')
    expect(result.error).toContain('cameras.0.tiltDeg: mountHeightM and tiltDeg must be set together')
  })
})

describe('parseProjectFile rejection cases', () => {
  it('rejects malformed JSON', () => {
    const result = parseProjectFile('{not json', KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects JSON with a literal NaN token (not valid JSON)', () => {
    const text = serializeProject(baseProject).replace('"x":10', '"x":NaN')
    const result = parseProjectFile(text, KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects the wrong app identifier', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.app = 'something-else'
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown/future schemaVersion', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.schemaVersion = 5
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects an SVG data URL (only png/jpeg allowed)', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.image.dataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects a remote http:// image URL', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.image.dataUrl = 'http://example.com/plan.png'
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects a string where a camera coordinate must be a number', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.cameras[0].x = '10'
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects extra unknown top-level keys', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.extraField = 'not allowed'
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects extra unknown keys on a nested camera object', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.cameras[0].extra = 'nope'
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects more than 500 cameras', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.cameras = Array.from({ length: 501 }, (_, i) => ({
      id: `cam-${i}`,
      modelId: 'model-a',
      x: i,
      y: i,
      rotationDeg: 0,
      rangeM: 10,
    }))
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
  })

  it('rejects oversized text', () => {
    const hugeText = 'x'.repeat(80 * 1024 * 1024 + 1)
    const result = parseProjectFile(hugeText, KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected rejection')
    expect(result.error).toMatch(/too large/i)
  })

  it('never throws on arbitrary garbage input', () => {
    expect(() => parseProjectFile('', KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)).not.toThrow()
    expect(() => parseProjectFile('null', KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)).not.toThrow()
    expect(() => parseProjectFile('42', KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)).not.toThrow()
    expect(() => parseProjectFile('[]', KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)).not.toThrow()
  })
})

describe('parseProjectFile - unknown model handling', () => {
  it('drops cameras referencing an unknown modelId and reports a warning', () => {
    const raw = JSON.parse(serializeProject(baseProject))
    raw.cameras.push({ id: 'cam-2', modelId: 'does-not-exist', x: 1, y: 1, rotationDeg: 0, rangeM: 10 })
    const result = parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.project.cameras).toHaveLength(1)
    expect(result.project.cameras[0].id).toBe('cam-1')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('does-not-exist')
  })
})
