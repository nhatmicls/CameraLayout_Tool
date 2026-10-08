import { describe, expect, it } from 'vitest'
import type { Cable, Hub, Shaft } from '../cable/cable-layout-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from './project-file-schema'
import { buildFloor, buildProjectWithFloors } from './project-file-test-fixtures'

const LOOKUPS: ProjectFileLookups = { cameraModelIds: new Set(['m']), sensorModelLookup: new Map(), fireAlarmModelIds: new Set() }

const SHAFT: Shaft = { id: 'shaft-1', name: 'Main shaft' }
const MARKER_F1: Hub = { id: 'm1', kind: 'shaft', shaftId: 'shaft-1', x: 10, y: 10, mountHeightM: 0, trunk: { hubId: 'h1', points: [] } }
const HUB_H1: Hub = { id: 'h1', x: 50, y: 50, mountHeightM: 1.5 }
const MARKER_F2: Hub = { id: 'm2', kind: 'shaft', shaftId: 'shaft-1', x: 20, y: 20, mountHeightM: 0, trunk: { hubId: 'h2', points: [] } }
const HUB_H2: Hub = { id: 'h2', x: 60, y: 60, mountHeightM: 1.5 }
const MARKER_F3: Hub = { id: 'm3', kind: 'shaft', shaftId: 'shaft-1', x: 30, y: 30, mountHeightM: 0 } // no trunk

function twoExitProject(cables: { floor1?: Cable[]; floor2?: Cable[]; floor3?: Cable[] } = {}) {
  return buildProjectWithFloors(
    [
      buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [MARKER_F1, HUB_H1], cables: cables.floor1 ?? [] }),
      buildFloor({ id: 'floor-2', name: 'Floor 2', hubs: [MARKER_F2, HUB_H2], cables: cables.floor2 ?? [] }),
      buildFloor({ id: 'floor-3', name: 'Floor 3', hubs: [MARKER_F3], cables: cables.floor3 ?? [] }),
    ],
    { shafts: [SHAFT] },
  )
}

function parseRaw(raw: unknown) {
  return parseProjectFile(JSON.stringify(raw), LOOKUPS)
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

describe('project file shafts - round trip', () => {
  it('round-trips two exits, the shafts[] list, and a cable with exitFloorId', () => {
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'm3', typeId: 'cat6-utp', points: [], exitFloorId: 'floor-1' }
    const project = twoExitProject({ floor3: [cable] })
    project.floors[2].cameras = [{ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }]

    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.shafts).toEqual([SHAFT])
    expect(result.project.floors[0].hubs).toEqual([MARKER_F1, HUB_H1])
    expect(result.project.floors[1].hubs).toEqual([MARKER_F2, HUB_H2])
    expect(result.project.floors[2].cables[0].exitFloorId).toBe('floor-1')
    expect(result.warnings).toEqual([])
  })

  it('D3: a marker with an unknown shaftId is dropped BEFORE the cable-ref check, so its cable gets the ordinary "unknown hub" warning too', () => {
    const rogueMarker: Hub = { id: 'rogue', kind: 'shaft', shaftId: 'ghost', x: 1, y: 1, mountHeightM: 0 }
    const rogueCable: Cable = { id: 'rogue-cable', device: { kind: 'camera', id: 'cam-x' }, hubId: 'rogue', typeId: 'cat6-utp', points: [] }
    const project = buildProjectWithFloors([
      buildFloor({
        id: 'floor-1',
        name: 'Floor 1',
        hubs: [rogueMarker],
        cables: [rogueCable],
        cameras: [{ id: 'cam-x', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }],
      }),
    ])
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].hubs).toEqual([])
    expect(result.project.floors[0].cables).toEqual([])
    // D3 fix: this test previously asserted the OPPOSITE (the marker surviving the cable-ref check,
    // then being silently dropped afterwards with no cable-specific warning) - that was the bug, not
    // a behaviour this phase deliberately kept. The marker is now gone BEFORE the cable-ref check
    // runs, so the dangling cable gets the SAME "unknown hub" warning any other dangling cable would.
    expect(result.warnings).toEqual([
      'a shaft marker references an unknown shaft; dropped.', // single floor - unprefixed
      'Cable "rogue-cable" references unknown hub "rogue"; dropped.',
    ])
  })

  it('a duplicate marker of the same shaft on one floor is dropped with a warning, keeping the first', () => {
    const dup: Hub = { id: 'dup', kind: 'shaft', shaftId: 'shaft-1', x: 2, y: 2, mountHeightM: 0 }
    const project = buildProjectWithFloors([buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [MARKER_F1, HUB_H1, dup] })], { shafts: [SHAFT] })
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].hubs.map((h) => h.id)).toEqual(['m1', 'h1'])
    expect(result.warnings.some((w) => w.includes('duplicate marker'))).toBe(true)
  })

  it('a shafts[] entry with no marker anywhere is dropped with a warning', () => {
    const project = buildProjectWithFloors([buildFloor({ id: 'floor-1', name: 'Floor 1' })], { shafts: [SHAFT] })
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.shafts).toEqual([])
    expect(result.warnings.some((w) => w.includes('no markers'))).toBe(true)
  })

  it('a stale exitFloorId (naming a floor that is not this shaft\'s exit) is cleared with a warning; the cable stays', () => {
    const cable: Cable = {
      id: 'c1',
      device: { kind: 'camera', id: 'cam-1' },
      hubId: 'm3',
      typeId: 'cat6-utp',
      points: [],
      exitFloorId: 'floor-3', // not an exit at all (m3 has no trunk)
    }
    const project = twoExitProject({ floor3: [cable] })
    project.floors[2].cameras = [{ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }]
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[2].cables).toHaveLength(1) // the cable itself is kept
    expect(result.project.floors[2].cables[0].exitFloorId).toBeUndefined() // just the stale choice cleared
    expect(result.warnings.some((w) => w.includes('exit no longer exists'))).toBe(true)
  })

  it('exitFloorId on a cable that does not end on a shaft marker at all is cleared with a warning', () => {
    const plainHub: Hub = { id: 'plain', x: 5, y: 5, mountHeightM: 1.5 }
    const cable: Cable = { id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'plain', typeId: 'cat6-utp', points: [], exitFloorId: 'floor-1' }
    const project = buildProjectWithFloors([
      buildFloor({
        id: 'floor-1',
        name: 'Floor 1',
        hubs: [plainHub],
        cables: [cable],
        cameras: [{ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }],
      }),
    ])
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].cables[0].exitFloorId).toBeUndefined()
    expect(result.warnings.some((w) => w.includes('exit no longer exists'))).toBe(true)
  })

  it('D3: a shaft marker carrying link opens anyway - link is dropped with a warning, never a file rejection', () => {
    const invalid = { ...MARKER_F1, link: { floorId: 'floor-1', hubId: 'h1' } }
    const project = buildProjectWithFloors([buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [invalid, HUB_H1] })], { shafts: [SHAFT] })
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].hubs[0].link).toBeUndefined()
    expect(result.project.floors[0].hubs[0].trunk).toEqual(MARKER_F1.trunk) // only `link` was touched
    expect(result.warnings).toEqual(['a shaft marker cannot be linked; link cleared.'])
  })

  it('D3: kind:\'shaft\' with no shaftId is dropped; a non-shaft hub with a stray shaftId has just the key cleared', () => {
    const shaftlessMarker = { id: 'no-shaft-id', kind: 'shaft' as const, x: 1, y: 1, mountHeightM: 0 }
    const strayShaftId = { id: 'plain-with-shaft-id', x: 2, y: 2, mountHeightM: 1.5, shaftId: 'shaft-1' }
    const project = buildProjectWithFloors([buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [shaftlessMarker, strayShaftId] })], {
      shafts: [SHAFT],
    })
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    // kind:'shaft' with no shaftId cannot function - dropped entirely.
    expect(result.project.floors[0].hubs.some((h) => h.id === 'no-shaft-id')).toBe(false)
    // A non-shaft hub keeps existing, just without the stray key.
    const kept = result.project.floors[0].hubs.find((h) => h.id === 'plain-with-shaft-id')
    expect(kept).toBeDefined()
    expect(kept!.shaftId).toBeUndefined()
    expect(result.warnings).toEqual([
      'a shaft marker has no shaftId; dropped.',
      'a non-shaft hub carried a stray shaftId; cleared.',
      'Shaft "Main shaft" has no markers; dropped.', // SHAFT itself now has no real marker either
    ])
  })

  it('H3: the loader is idempotent - parse(serialize(parse(x))) emits NO new warnings for a crafted file', () => {
    // A deliberately messy file: an unknown-shaftId marker (with a cable on it), a duplicate
    // marker, a stale exitFloorId, and a shaft marker carrying `link` - every D3/loader rule at once.
    const rogue: Hub = { id: 'rogue', kind: 'shaft', shaftId: 'ghost', x: 1, y: 1, mountHeightM: 0 }
    const dup: Hub = { id: 'dup', kind: 'shaft', shaftId: 'shaft-1', x: 2, y: 2, mountHeightM: 0 }
    const linked = { ...MARKER_F1, link: { floorId: 'floor-1', hubId: 'h1' } }
    const staleCable: Cable = { id: 'stale', device: { kind: 'camera', id: 'cam-1' }, hubId: 'rogue', typeId: 'cat6-utp', points: [] }
    const project = buildProjectWithFloors(
      [
        buildFloor({
          id: 'floor-1',
          name: 'Floor 1',
          hubs: [linked, HUB_H1, dup, rogue],
          cables: [staleCable],
          cameras: [{ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }],
        }),
      ],
      { shafts: [SHAFT] },
    )

    const firstParse = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(firstParse.warnings.length).toBeGreaterThan(0) // sanity: the crafted file really was messy

    const secondParse = expectOk(parseRaw(JSON.parse(serializeProject(firstParse.project))))
    expect(secondParse.warnings).toEqual([]) // everything the first pass fixed stays fixed - no re-triggering
    expect(secondParse.project).toEqual(firstParse.project)
  })
})
