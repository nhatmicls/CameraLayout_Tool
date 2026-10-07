import { describe, expect, it } from 'vitest'
import { MAX_WALLS, WALLS_CROSS_WARNING, parseProjectFile, serializeProject, type ProjectFileLookups, type SensorModelLookup } from './project-file-schema'
import { buildLegacyFlatRaw, buildProject, onlyFloor } from './project-file-test-fixtures'
import type { Wall } from './project-types'

const KNOWN_MODEL_IDS = new Set(['model-a'])
const SENSOR_MODEL_LOOKUP: SensorModelLookup = new Map()
const LOOKUPS: ProjectFileLookups = {
  cameraModelIds: KNOWN_MODEL_IDS,
  sensorModelLookup: SENSOR_MODEL_LOOKUP,
  fireAlarmModelIds: new Set(),
}

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, kind: Wall['kind'] = 'opaque'): Wall => ({
  id,
  kind,
  x1,
  y1,
  x2,
  y2,
})

function projectWithWalls(walls: Wall[]) {
  return buildProject({
    cameras: [{ id: 'cam-1', modelId: 'model-a', x: 10, y: 20, rotationDeg: 45, rangeM: 15 }],
    walls,
  })
}

/** The on-disk object for floor 0's `walls`, with `mutate` applied before it is parsed. */
function parseRaw(walls: unknown, mutate: (raw: Record<string, unknown>) => void = () => {}) {
  const raw = JSON.parse(serializeProject(projectWithWalls([]))) as { floors: Array<Record<string, unknown>> } & Record<string, unknown>
  raw.floors[0].walls = walls
  mutate(raw)
  return parseProjectFile(JSON.stringify(raw), LOOKUPS)
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
  it.each([1, 2, 3, 4])('loads a legacy version %i file without `walls` as an empty wall list', (version) => {
    const raw = buildLegacyFlatRaw(version, {
      cameras: [{ id: 'cam-1', modelId: 'model-a', x: 10, y: 20, rotationDeg: 45, rangeM: 15 }],
    })
    const result = expectOk(parseProjectFile(JSON.stringify(raw), LOOKUPS))
    expect(onlyFloor(result).walls).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('accepts `walls: []`', () => {
    expect(onlyFloor(expectOk(parseRaw([]))).walls).toEqual([])
  })
})

describe('project file walls - round trip', () => {
  it('preserves opaque and glass walls exactly', () => {
    const project = projectWithWalls([wall('w1', 10.5, 20.25, 300, 20.25), wall('w2', 300, 20.25, 300, 400, 'glass')])
    const result = expectOk(parseProjectFile(serializeProject(project), LOOKUPS))
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
    expect(onlyFloor(expectOk(parseRaw(many.slice(0, MAX_WALLS)))).walls).toHaveLength(MAX_WALLS)
  })
})

describe('project file walls - normalisation warnings', () => {
  it('drops a zero-length wall with a warning and keeps the rest', () => {
    const result = expectOk(parseRaw([wall('real', 0, 0, 50, 0), wall('dot', 7, 7, 7, 7)]))
    expect(onlyFloor(result).walls.map((w) => w.id)).toEqual(['real'])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('dot')
  })

  it('drops a repeated id with a warning, keeping the first', () => {
    const result = expectOk(parseRaw([wall('dup', 0, 0, 50, 0), wall('dup', 0, 10, 50, 10)]))
    expect(onlyFloor(result).walls).toEqual([wall('dup', 0, 0, 50, 0)])
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
    expect(onlyFloor(result).walls).toHaveLength(4)
    expect(result.warnings).toEqual([WALLS_CROSS_WARNING])
  })

  it('raises no crossing warning for a closed room with shared corners and a T-junction', () => {
    const result = expectOk(parseRaw([...CLOSED_ROOM, wall('partition', 50, 0, 50, 60)]))
    expect(onlyFloor(result).walls).toHaveLength(5)
    expect(result.warnings).toEqual([])
  })
})
