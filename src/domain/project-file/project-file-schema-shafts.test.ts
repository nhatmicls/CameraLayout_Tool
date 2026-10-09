import { describe, expect, it } from 'vitest'
import type { Cable, Hub, Shaft } from '../cable/cable-layout-types'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from './project-file-schema'
import { buildFloor, buildProjectWithFloors } from './project-file-test-fixtures'

const LOOKUPS: ProjectFileLookups = { cameraModelIds: new Set(['m']), sensorModelLookup: new Map(), fireAlarmModelIds: new Set() }

const SHAFT: Shaft = { id: 'shaft-1', name: 'Main shaft' }
const MARKER_F1: Hub = { id: 'm1', kind: 'shaft', shaftId: 'shaft-1', x: 10, y: 10, mountHeightM: 0 }
const HUB_H1: Hub = { id: 'h1', x: 50, y: 50, mountHeightM: 1.5 }
const MARKER_F2: Hub = { id: 'm2', kind: 'shaft', shaftId: 'shaft-1', x: 20, y: 20, mountHeightM: 0 }
const HUB_H2: Hub = { id: 'h2', x: 60, y: 60, mountHeightM: 1.5 }
const MARKER_F3: Hub = { id: 'm3', kind: 'shaft', shaftId: 'shaft-1', x: 30, y: 30, mountHeightM: 0 }

function threeFloorShaftProject(cables: { floor1?: Cable[]; floor2?: Cable[]; floor3?: Cable[] } = {}) {
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

const CAMERA = { id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 }
const cableOnF3 = (extra: Partial<Cable> & { exitFloorId?: string } = {}): Cable => ({ id: 'c1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'm3', typeId: 'cat6-utp', points: [], ...extra })

describe('project file shafts - a cable\'s own route beyond a shaft', () => {
  it('round-trips the shafts[] list, the openings and a cable routed to a hub and to a device on other floors', () => {
    const toHub = cableOnF3({ beyondShaft: { floorId: 'floor-1', points: [{ x: 12, y: 40 }], hubId: 'h1' } })
    const toDevice = cableOnF3({ id: 'c2', beyondShaft: { floorId: 'floor-2', points: [], endDevice: { kind: 'camera', id: 'cam-2' } } })
    const project = threeFloorShaftProject({ floor3: [toHub, toDevice] })
    project.floors[2].cameras = [CAMERA]
    project.floors[1].cameras = [{ ...CAMERA, id: 'cam-2' }]

    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project).toEqual(project)
    expect(result.warnings).toEqual([])
  })

  it.each<[string, Cable['beyondShaft']]>([
    ['its end hub is gone', { floorId: 'floor-1', points: [], hubId: 'gone' }],
    ['its exit floor is gone', { floorId: 'floor-9', points: [], hubId: 'h1' }],
    ['it ends on a shaft opening', { floorId: 'floor-1', points: [], hubId: 'm1' }],
    ['it names no end', { floorId: 'floor-1', points: [] }],
  ])('a route is cleared with a warning when %s; the cable itself is kept', (_reason, beyondShaft) => {
    const project = threeFloorShaftProject({ floor3: [cableOnF3({ beyondShaft })] })
    project.floors[2].cameras = [CAMERA]
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[2].cables).toEqual([cableOnF3()])
    expect(result.warnings).toEqual(['Cable "c1"\'s route beyond its shaft is no longer valid; cleared.'])
  })

  it('a route on a cable that does not end on a shaft opening is cleared with a warning', () => {
    const project = threeFloorShaftProject({ floor1: [{ ...cableOnF3({ beyondShaft: { floorId: 'floor-2', points: [], hubId: 'h2' } }), hubId: 'h1' }] })
    project.floors[0].cameras = [CAMERA]
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].cables[0]).not.toHaveProperty('beyondShaft')
    expect(result.warnings).toHaveLength(1)
  })
})

describe('project file shafts - pre-v9 shared exits are converted to one route per cable', () => {
  /** A v8 file as an older build wrote it: exits are a `trunk` on a shaft opening, a cable names one with `exitFloorId`. */
  function legacyRaw(cables: Array<Cable & { exitFloorId?: string }>, exitTrunks: { f1?: boolean; f2?: boolean }) {
    const project = threeFloorShaftProject({ floor3: cables })
    project.floors[2].cameras = [CAMERA]
    const raw = JSON.parse(serializeProject(project))
    raw.schemaVersion = 8
    if (exitTrunks.f1) raw.floors[0].hubs[0].trunk = { hubId: 'h1', points: [{ x: 12, y: 40 }] }
    if (exitTrunks.f2) raw.floors[1].hubs[0].trunk = { hubId: 'h2', points: [] }
    return raw
  }

  it('one exit: the cable used it implicitly and now owns a copy of that route; no warning; the opening carries no route', () => {
    const result = expectOk(parseRaw(legacyRaw([cableOnF3()], { f1: true })))
    expect(result.project.floors[2].cables[0].beyondShaft).toEqual({ floorId: 'floor-1', points: [{ x: 12, y: 40 }], hubId: 'h1' })
    expect(result.project.floors[0].hubs[0]).toEqual(MARKER_F1)
    expect(result.warnings).toEqual([])
  })

  it('several exits: the chosen one is copied and the choice key is gone; an unchosen cable is left not routed', () => {
    const result = expectOk(parseRaw(legacyRaw([cableOnF3({ exitFloorId: 'floor-2' }), cableOnF3({ id: 'c2' })], { f1: true, f2: true })))
    const [chosen, unchosen] = result.project.floors[2].cables
    expect(chosen).toEqual(cableOnF3({ beyondShaft: { floorId: 'floor-2', points: [], hubId: 'h2' } }))
    expect(unchosen).toEqual(cableOnF3({ id: 'c2' }))
    expect(result.project.floors.flatMap((floor) => floor.hubs).some((hub) => hub.trunk)).toBe(false)
    // It used to be left out of the totals; it now counts up to the shaft - said once, on load.
    expect(result.warnings).toEqual(['1 cable had no shaft exit chosen and opens as not routed: counted up to the shaft until routed from the shaft panel.'])
  })

  it('saving the converted project writes version 9 with no trunk on an opening and no exitFloorId', () => {
    const converted = expectOk(parseRaw(legacyRaw([cableOnF3({ exitFloorId: 'floor-1' })], { f1: true, f2: true }))).project
    const text = serializeProject(converted)
    expect(JSON.parse(text).schemaVersion).toBe(9)
    expect(text).not.toContain('exitFloorId')
    expect(text).not.toContain('trunk')
    expect(expectOk(parseProjectFile(text, LOOKUPS)).project).toEqual(converted)
  })
})

describe('project file shafts - round trip', () => {
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

  it('D3: a shaft marker carrying link opens anyway - link is dropped with a warning, never a file rejection', () => {
    const invalid = { ...MARKER_F1, link: { floorId: 'floor-1', hubId: 'h1' } }
    const project = buildProjectWithFloors([buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [invalid, HUB_H1] })], { shafts: [SHAFT] })
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].hubs[0].link).toBeUndefined()
    expect(result.project.floors[0].hubs[0]).toEqual(MARKER_F1) // only `link` was touched
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
    // marker, a route beyond a shaft whose end is gone, and a shaft marker carrying `link` - every loader rule at once.
    const rogue: Hub = { id: 'rogue', kind: 'shaft', shaftId: 'ghost', x: 1, y: 1, mountHeightM: 0 }
    const dup: Hub = { id: 'dup', kind: 'shaft', shaftId: 'shaft-1', x: 2, y: 2, mountHeightM: 0 }
    const linked = { ...MARKER_F1, link: { floorId: 'floor-1', hubId: 'h1' } }
    const staleCable: Cable = { id: 'stale', device: { kind: 'camera', id: 'cam-1' }, hubId: 'rogue', typeId: 'cat6-utp', points: [] }
    const deadLeg: Cable = { id: 'dead-leg', device: { kind: 'camera', id: 'cam-1' }, hubId: 'm1', typeId: 'cat6-utp', points: [], beyondShaft: { floorId: 'floor-1', points: [], hubId: 'gone' } }
    const project = buildProjectWithFloors(
      [
        buildFloor({
          id: 'floor-1',
          name: 'Floor 1',
          hubs: [linked, HUB_H1, dup, rogue],
          cables: [staleCable, deadLeg],
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
