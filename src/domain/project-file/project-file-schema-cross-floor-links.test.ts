import { describe, expect, it } from 'vitest'
import type { Hub } from '../cable/cable-layout-types'
import { setHubTrunk, unlinkHub } from '../cable/cross-floor-hub-link-writer'
import { parseProjectFile, serializeProject, type ProjectFileLookups } from './project-file-schema'
import { buildFloor, buildProjectWithFloors } from './project-file-test-fixtures'

const LOOKUPS: ProjectFileLookups = { cameraModelIds: new Set(), sensorModelLookup: new Map(), fireAlarmModelIds: new Set() }

const RISER: Hub = { id: 'riser-1', kind: 'riser', x: 50, y: 50, mountHeightM: 3, link: { floorId: 'floor-2', hubId: 'drop-1' } }
const DROP: Hub = {
  id: 'drop-1',
  kind: 'drop',
  x: 50,
  y: 50,
  mountHeightM: 0,
  link: { floorId: 'floor-1', hubId: 'riser-1' },
  trunk: { hubId: 'hub-2', points: [{ x: 1, y: 1 }] },
}
const PLAIN_HUB: Hub = { id: 'hub-2', x: 90, y: 90, mountHeightM: 1.5 }

function linkedProject() {
  return buildProjectWithFloors([
    buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [RISER] }),
    buildFloor({ id: 'floor-2', name: 'Floor 2', hubs: [DROP, PLAIN_HUB] }),
  ])
}

/** Same as `linkedProject`, plus a third, empty floor - for the non-adjacent/wrong-direction item 8 test gaps. */
function threeFloorProject() {
  return buildProjectWithFloors([
    buildFloor({ id: 'floor-1', name: 'Floor 1', hubs: [RISER] }),
    buildFloor({ id: 'floor-2', name: 'Floor 2', hubs: [DROP, PLAIN_HUB] }),
    buildFloor({ id: 'floor-3', name: 'Floor 3', hubs: [] }),
  ])
}

function parseRaw(raw: unknown) {
  return parseProjectFile(JSON.stringify(raw), LOOKUPS)
}

function expectOk(result: ReturnType<typeof parseProjectFile>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
  return result
}

describe('project file cross-floor links - round trip', () => {
  it('round-trips a linked riser/drop with a trunk, no warnings', () => {
    const project = linkedProject()
    const result = expectOk(parseRaw(JSON.parse(serializeProject(project))))
    expect(result.project.floors[0].hubs).toEqual([RISER])
    expect(result.project.floors[1].hubs).toEqual([DROP, PLAIN_HUB])
    expect(result.warnings).toEqual([])
  })
})

describe('unlinkHub / setHubTrunk(null) delete their keys outright, so in-memory state deep-equals a reloaded project (bug fix)', () => {
  it('after unlinkHub: neither side keeps a stray `link`/`trunk: undefined` key', () => {
    const project = linkedProject()
    const floorsAfterUnlink = unlinkHub(project.floors, { floorId: 'floor-1', hubId: 'riser-1' })
    const reloaded = expectOk(parseRaw(JSON.parse(serializeProject({ ...project, floors: floorsAfterUnlink }))))
    // toStrictEqual (unlike toEqual) tells apart a MISSING key from one present with value `undefined` -
    // exactly the bug: `{ ...hub, link: undefined }` is NOT the same shape as a hub that never had `link`.
    expect(reloaded.project.floors).toStrictEqual(floorsAfterUnlink)
  })

  it('after setHubTrunk(ref, null): no stray `trunk: undefined` key', () => {
    const project = linkedProject()
    const floorsAfterClear = setHubTrunk(project.floors, { floorId: 'floor-2', hubId: 'drop-1' }, null)
    const reloaded = expectOk(parseRaw(JSON.parse(serializeProject({ ...project, floors: floorsAfterClear }))))
    expect(reloaded.project.floors).toStrictEqual(floorsAfterClear)
  })
})

describe('project file cross-floor links - invalid refs dropped with a warning, file still loads', () => {
  function rawWithFloor2Hubs(floor2Hubs: Hub[]): Record<string, unknown> {
    const raw = JSON.parse(serializeProject(linkedProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[1].hubs = floor2Hubs
    return raw
  }

  it('link to an unknown floorId', () => {
    const raw = JSON.parse(serializeProject(linkedProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[0].hubs = [{ ...RISER, link: { floorId: 'does-not-exist', hubId: 'drop-1' } }]
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[0].hubs[0].link).toBeUndefined()
    expect(result.warnings).toHaveLength(2) // riser-1's bad link + drop-1's now-orphaned trunk (it never pointed back)
  })

  it('link to an unknown hubId on the right floor', () => {
    const raw = JSON.parse(serializeProject(linkedProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[0].hubs = [{ ...RISER, link: { floorId: 'floor-2', hubId: 'does-not-exist' } }]
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[0].hubs[0].link).toBeUndefined()
  })

  it('a one-sided link (drop-1 does not point back) drops riser-1\'s side and drop-1\'s orphaned trunk', () => {
    const raw = rawWithFloor2Hubs([{ ...DROP, link: undefined }, PLAIN_HUB])
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[0].hubs[0].link).toBeUndefined()
    expect(result.project.floors[1].hubs[0].trunk).toBeUndefined()
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('a trunk to a missing hub is dropped, the link itself stays', () => {
    const raw = rawWithFloor2Hubs([{ ...DROP, trunk: { hubId: 'gone', points: [] } }, PLAIN_HUB])
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[1].hubs[0].trunk).toBeUndefined()
    expect(result.project.floors[1].hubs[0].link).toEqual({ floorId: 'floor-1', hubId: 'riser-1' })
    expect(result.warnings).toEqual([expect.stringContaining('route dropped')])
  })

  it('item 8: non-adjacent floor (links to floor 3, skipping floor 2) - dropped', () => {
    const raw = JSON.parse(serializeProject(threeFloorProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[0].hubs = [{ ...RISER, link: { floorId: 'floor-3', hubId: 'does-not-matter' } }]
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[0].hubs[0].link).toBeUndefined()
  })

  it('item 8: wrong direction (a riser on floor 2 linking DOWN to floor 1 instead of up to floor 3) - dropped', () => {
    const wrongDirectionRiser: Hub = { id: 'riser-wrong', kind: 'riser', x: 10, y: 10, mountHeightM: 3, link: { floorId: 'floor-1', hubId: 'riser-1' } }
    const raw = JSON.parse(serializeProject(threeFloorProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[1].hubs = [DROP, PLAIN_HUB, wrongDirectionRiser]
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[1].hubs.find((h) => h.id === 'riser-wrong')!.link).toBeUndefined()
    expect(result.project.floors[0].hubs[0].link).toEqual({ floorId: 'floor-2', hubId: 'drop-1' }) // the real pair is untouched
  })

  it('item 8: a plain hub carrying a link (no kind) - dropped', () => {
    const raw = JSON.parse(serializeProject(linkedProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[1].hubs = [DROP, { ...PLAIN_HUB, link: { floorId: 'floor-1', hubId: 'riser-1' } }]
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[1].hubs.find((h) => h.id === 'hub-2')!.link).toBeUndefined()
  })

  it('item 8: a third-party hub also claiming the real partner - the imposter is dropped, the real pair survives', () => {
    const imposterRiser: Hub = { id: 'imposter-riser', kind: 'riser', x: 1, y: 1, mountHeightM: 3, link: { floorId: 'floor-2', hubId: 'drop-1' } }
    const raw = JSON.parse(serializeProject(linkedProject())) as { floors: Array<{ hubs: Hub[] }> }
    raw.floors[0].hubs = [RISER, imposterRiser]
    const result = expectOk(parseRaw(raw))
    const floor1Hubs = result.project.floors[0].hubs
    expect(floor1Hubs.find((h) => h.id === 'riser-1')!.link).toEqual({ floorId: 'floor-2', hubId: 'drop-1' })
    expect(floor1Hubs.find((h) => h.id === 'imposter-riser')!.link).toBeUndefined()
  })

  it('item 8: a trunk targeting a hub that exists but on a DIFFERENT floor - dropped (same-floor check, not "exists anywhere")', () => {
    const raw = rawWithFloor2Hubs([{ ...DROP, trunk: { hubId: 'riser-1', points: [] } }, PLAIN_HUB]) // riser-1 exists, but on floor-1
    const result = expectOk(parseRaw(raw))
    expect(result.project.floors[1].hubs[0].trunk).toBeUndefined()
    expect(result.project.floors[1].hubs[0].link).toEqual({ floorId: 'floor-1', hubId: 'riser-1' }) // link itself stays valid
  })
})
