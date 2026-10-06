import { describe, expect, it } from 'vitest'
import { MAX_WALLS, WALLS_CROSS_WARNING, parseProjectFile, serializeProject, type SensorModelLookup } from './project-file-schema'
import type { Project, Wall } from './project-types'

// Smallest possible valid PNG (1x1 transparent pixel), as a real base64 data URL.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAk6WgQAAAABJRU5ErkJggg=='

const KNOWN_MODEL_IDS = new Set(['model-a'])
const SENSOR_MODEL_LOOKUP: SensorModelLookup = new Map()

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'opaque'): Wall => ({
  id,
  kind,
  x1,
  y1,
  x2,
  y2,
})

function projectWith(walls: Wall[]): Project {
  return {
    image: { dataUrl: TINY_PNG_DATA_URL, widthPx: 1000, heightPx: 800, fileName: 'floor-plan.png' },
    scale: null,
    cameras: [{ id: 'cam-1', modelId: 'model-a', x: 10, y: 20, rotationDeg: 45, rangeM: 15 }],
    walls,
    sensors: [],
  }
}

/** The on-disk object for `walls`, with `mutate` applied before it is parsed. */
function parseRaw(walls: unknown, mutate: (raw: Record<string, unknown>) => void = () => {}) {
  const raw = JSON.parse(serializeProject(projectWith([]))) as Record<string, unknown>
  raw.walls = walls
  mutate(raw)
  return parseProjectFile(JSON.stringify(raw), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP)
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

const CLOSED_ROOM = [
  wall('n', 0, 0, 100, 0),
  wall('e', 100, 0, 100, 100),
  wall('s', 100, 100, 0, 100),
  wall('w', 0, 100, 0, 0),
]

describe('project file walls - back-compat', () => {
  it.each([1, 2])('loads a version %i file without `walls` as an empty wall list', (version) => {
    const result = expectOk(
      parseRaw(undefined, (raw) => {
        delete raw.walls
        raw.schemaVersion = version
      }),
    )
    expect(result.project.walls).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('accepts `walls: []`', () => {
    expect(expectOk(parseRaw([])).project.walls).toEqual([])
  })
})

describe('project file walls - round trip', () => {
  it('preserves opaque and glass walls exactly', () => {
    const project = projectWith([wall('w1', 10.5, 20.25, 300, 20.25), wall('w2', 300, 20.25, 300, 400, 'glass')])
    const result = expectOk(parseProjectFile(serializeProject(project), KNOWN_MODEL_IDS, SENSOR_MODEL_LOOKUP))
    expect(result.project).toEqual(project)
    expect(result.warnings).toEqual([])
  })
})

describe('project file walls - rejected input', () => {
  const valid = wall('w1', 0, 0, 50, 0)

  it('rejects an unknown kind', () => {
    expect(parseRaw([{ ...valid, kind: 'brick' }]).ok).toBe(false)
  })

  it('rejects an extra key on a wall', () => {
    expect(parseRaw([{ ...valid, thickness: 2 }]).ok).toBe(false)
  })

  it('rejects a coordinate given as a string', () => {
    expect(parseRaw([{ ...valid, x2: 'NaN' }]).ok).toBe(false)
  })

  it('rejects a coordinate beyond the limit', () => {
    expect(parseRaw([{ ...valid, x2: 1_000_001 }]).ok).toBe(false)
    expect(parseRaw([{ ...valid, y1: -1_000_001 }]).ok).toBe(false)
  })

  it('rejects an empty id', () => {
    expect(parseRaw([{ ...valid, id: '' }]).ok).toBe(false)
  })

  it(`rejects more than ${MAX_WALLS} walls and accepts exactly ${MAX_WALLS}`, () => {
    const many = Array.from({ length: MAX_WALLS + 1 }, (_, i) => wall(`w${i}`, 0, i * 2, 50, i * 2))
    expect(parseRaw(many).ok).toBe(false)
    expect(expectOk(parseRaw(many.slice(0, MAX_WALLS))).project.walls).toHaveLength(MAX_WALLS)
  })
})

describe('project file walls - normalisation warnings', () => {
  it('drops a zero-length wall with a warning and keeps the rest', () => {
    const result = expectOk(parseRaw([wall('real', 0, 0, 50, 0), wall('dot', 7, 7, 7, 7)]))
    expect(result.project.walls.map((w) => w.id)).toEqual(['real'])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('dot')
  })

  it('drops a repeated id with a warning, keeping the first', () => {
    const result = expectOk(parseRaw([wall('dup', 0, 0, 50, 0), wall('dup', 0, 10, 50, 10)]))
    expect(result.project.walls).toEqual([wall('dup', 0, 0, 50, 0)])
    expect(result.warnings).toHaveLength(1)
  })

  it('keeps crossing walls and raises exactly one warning, however many pairs cross', () => {
    const crossing = [
      wall('h', 0, 50, 100, 50),
      wall('v1', 20, 0, 20, 100),
      wall('v2', 50, 0, 50, 100),
      wall('v3', 80, 0, 80, 100, 'glass'),
    ]
    const result = expectOk(parseRaw(crossing))
    expect(result.project.walls).toHaveLength(4)
    expect(result.warnings).toEqual([WALLS_CROSS_WARNING])
  })

  it('raises no crossing warning for a closed room with shared corners and a T-junction', () => {
    const result = expectOk(parseRaw([...CLOSED_ROOM, wall('partition', 50, 0, 50, 60)]))
    expect(result.project.walls).toHaveLength(5)
    expect(result.warnings).toEqual([])
  })
})
