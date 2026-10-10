import { describe, expect, it } from 'vitest'
import type { Floor } from '../floor/floor-types'
import type { Hub } from './cable-layout-types'
import { crossFloorLinkProblem, crossFloorTrunkProblem, listLinkCandidates, pruneInvalidCrossFloorLinks } from './cross-floor-hub-link-integrity'
import { twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

function floorsOf(overrides: { floor0?: Partial<Floor>; floor1?: Partial<Floor> } = {}): Floor[] {
  return twoFloorLinkedProject(overrides).floors
}

const PLAIN_HUB: Hub = { id: 'plain-1', x: 1, y: 1, mountHeightM: 1.5 }

describe('crossFloorLinkProblem', () => {
  it('is null for the valid riser-to-drop-above pair and the reverse read', () => {
    const floors = floorsOf()
    expect(crossFloorLinkProblem(floors, 0, floors[0].hubs[0])).toBeNull() // riser-1
    expect(crossFloorLinkProblem(floors, 1, floors[1].hubs[0])).toBeNull() // drop-1
  })

  it('is null when unset', () => {
    expect(crossFloorLinkProblem(floorsOf(), 1, PLAIN_HUB)).toBeNull()
  })

  it('rejects a riser on floor 1 claiming to link to floor 0 (its own floor is not "above")', () => {
    const floors = floorsOf()
    const riserOnTopFloor: Hub = { id: 'riser-x', kind: 'riser', x: 0, y: 0, mountHeightM: 3, link: { floorId: 'floor-0', hubId: 'riser-1' } }
    expect(crossFloorLinkProblem(floors, 1, riserOnTopFloor)).toMatch(/floor above/)
  })

  it('rejects a plain hub carrying a link', () => {
    const floors = floorsOf()
    expect(crossFloorLinkProblem(floors, 0, { ...PLAIN_HUB, link: { floorId: 'floor-1', hubId: 'drop-1' } })).toMatch(/plain hub/)
  })

  it('rejects a link to a missing partner', () => {
    const floors = floorsOf()
    const riser = { ...floors[0].hubs[0], link: { floorId: 'floor-1', hubId: 'missing' } }
    expect(crossFloorLinkProblem(floors, 0, riser)).toMatch(/no longer exists/)
  })

  it('rejects a link to the wrong kind', () => {
    const floors = floorsOf({ floor1: { hubs: [{ id: 'not-a-drop', x: 0, y: 0, mountHeightM: 1.5 }] } })
    const riser = { ...floors[0].hubs[0], link: { floorId: 'floor-1', hubId: 'not-a-drop' } }
    expect(crossFloorLinkProblem(floors, 0, riser)).toMatch(/not a drop/)
  })

  it('rejects a one-sided link (partner does not point back)', () => {
    const floors = floorsOf({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0 }] } }) // no link back
    expect(crossFloorLinkProblem(floors, 0, floors[0].hubs[0])).toMatch(/not linked back/)
  })

  it('non-adjacent floor is rejected (same symmetry check as missing partner floor)', () => {
    const floors = floorsOf()
    const riser = { ...floors[0].hubs[0], link: { floorId: 'does-not-exist', hubId: 'x' } }
    expect(crossFloorLinkProblem(floors, 0, riser)).toMatch(/floor above/)
  })
})

describe('crossFloorTrunkProblem', () => {
  it('is null for the valid trunk and when unset', () => {
    const floors = floorsOf()
    expect(crossFloorTrunkProblem(floors, 1, floors[1].hubs[0])).toBeNull()
    expect(crossFloorTrunkProblem(floors, 0, floors[0].hubs[0])).toBeNull()
  })

  it('rejects a trunk on an unlinked point', () => {
    const floors = floorsOf()
    const unlinkedWithTrunk = { ...PLAIN_HUB, kind: 'riser' as const, trunk: { hubId: 'x', points: [] } }
    expect(crossFloorTrunkProblem(floors, 0, unlinkedWithTrunk)).toMatch(/not validly linked/)
  })

  it('rejects a self-targeting trunk', () => {
    const floors = floorsOf()
    const selfTrunk = { ...floors[1].hubs[0], trunk: { hubId: floors[1].hubs[0].id, points: [] } }
    expect(crossFloorTrunkProblem(floors, 1, selfTrunk)).toMatch(/itself/)
  })

  it('rejects a trunk to a missing target', () => {
    const floors = floorsOf()
    const badTrunk = { ...floors[1].hubs[0], trunk: { hubId: 'gone', points: [] } }
    expect(crossFloorTrunkProblem(floors, 1, badTrunk)).toMatch(/no longer exists/)
  })

  it('D1: rejects a trunk that targets a shaft marker, from a riser/drop owner', () => {
    const shaftMarker: Hub = { id: 'shaft-m', kind: 'shaft', shaftId: 's1', x: 0, y: 0, mountHeightM: 0 }
    const floors = floorsOf({ floor1: { hubs: [{ ...floorsOf()[1].hubs[0], trunk: { hubId: 'shaft-m', points: [] } }, shaftMarker] } })
    expect(crossFloorTrunkProblem(floors, 1, floors[1].hubs[0])).toMatch(/shaft marker/)
  })

  it('rejects ANY trunk on a shaft opening - each cable owns its route beyond a shaft', () => {
    const ownerMarker: Hub = { id: 'owner-m', kind: 'shaft', shaftId: 's2', x: 0, y: 0, mountHeightM: 0, trunk: { hubId: 'plain', points: [] } }
    const plain: Hub = { id: 'plain', x: 10, y: 10, mountHeightM: 1.5 }
    const floors = floorsOf({ floor0: { hubs: [ownerMarker, plain] } })
    expect(crossFloorTrunkProblem(floors, 0, ownerMarker)).toMatch(/shaft opening/)
  })
})

describe('listLinkCandidates', () => {
  it('lists the opposite kind on the one legal adjacent floor, including the current partner', () => {
    const floors = floorsOf()
    const candidates = listLinkCandidates(floors, 0, floors[0].hubs[0])
    expect(candidates).toEqual([{ floorId: 'floor-1', hubId: 'drop-1', label: 'Floor 2 D1' }])
  })

  it('is empty for a plain hub, and for a riser with no floor above', () => {
    const floors = floorsOf()
    expect(listLinkCandidates(floors, 0, PLAIN_HUB)).toEqual([])
    expect(listLinkCandidates(floors, 1, { ...PLAIN_HUB, kind: 'riser' })).toEqual([]) // floor 1 is the top floor here
  })

  it('excludes a candidate already linked to someone else', () => {
    const floors = floorsOf({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, link: { floorId: 'floor-0', hubId: 'someone-else' } }] } })
    expect(listLinkCandidates(floors, 0, floors[0].hubs[0])).toEqual([])
  })
})

describe('pruneInvalidCrossFloorLinks', () => {
  it('returns the same array when every link/trunk is valid', () => {
    const floors = floorsOf()
    expect(pruneInvalidCrossFloorLinks(floors)).toBe(floors)
  })

  it('drops a one-sided link detected from the linked side, and the orphaned trunk left on the unlinked side', () => {
    // drop-1 carries its usual trunk but no link back - two independent problems, caught from each side.
    const floors = floorsOf({ floor1: { hubs: [{ id: 'drop-1', kind: 'drop', x: 700, y: 500, mountHeightM: 0, trunk: { hubId: 'plain-hub-2', points: [] } }, PLAIN_HUB] } })
    const warnings: string[] = []
    const next = pruneInvalidCrossFloorLinks(floors, undefined, undefined, warnings)
    expect(next[0].hubs[0].link).toBeUndefined() // riser-1's link pruned (partner doesn't point back)
    const drop = next[1].hubs.find((h) => h.id === 'drop-1')!
    expect(drop.trunk).toBeUndefined() // drop-1's own orphaned trunk pruned (it was never actually linked)
    expect(warnings).toHaveLength(2)
    // Item 7 fix: named by floor + R1/D1-style label, not the hub's raw (uuid) id.
    expect(warnings.some((w) => /Floor 1 R1/.test(w) && /link dropped/.test(w))).toBe(true)
    expect(warnings.some((w) => /Floor 2 D1/.test(w) && /route dropped/.test(w))).toBe(true)
  })

  it('drops an orphaned trunk left behind by hub deletion, keeping the link intact on the surviving side', () => {
    const floors = floorsOf()
    const hubDeleted: Floor[] = [floors[0], { ...floors[1], hubs: [floors[1].hubs[0]] }] // plain-hub-2 deleted; drop-1's trunk now dangles
    const warnings: string[] = []
    const next = pruneInvalidCrossFloorLinks(hubDeleted, undefined, undefined, warnings)
    expect(next[1].hubs[0].trunk).toBeUndefined()
    expect(next[1].hubs[0].link).toEqual({ floorId: 'floor-0', hubId: 'riser-1' }) // link itself stays valid
    expect(next[0].hubs[0].link).toEqual({ floorId: 'floor-1', hubId: 'drop-1' })
    expect(warnings.some((w) => /route dropped/.test(w))).toBe(true)
  })

  it('M5: a dropped trunk\'s warning labels a shaft marker "T{n}" from the PROJECT order, not a per-floor count', () => {
    // Two shafts share floor-1: "shaft-b" is listed first in the (fake) project order passed in,
    // but its marker sits SECOND in the floor's own hubs array - a per-floor count would call it "T2".
    const markerA: Hub = { id: 'marker-a', kind: 'shaft', shaftId: 'shaft-a', x: 0, y: 0, mountHeightM: 0 }
    const markerB: Hub = {
      id: 'marker-b',
      kind: 'shaft',
      shaftId: 'shaft-b',
      x: 1,
      y: 1,
      mountHeightM: 0,
      trunk: { hubId: 'gone', points: [] }, // a shaft opening never carries a route - triggers the warning this test reads
    }
    const floors = floorsOf({ floor1: { hubs: [markerA, markerB] } })
    const warnings: string[] = []
    pruneInvalidCrossFloorLinks(floors, ['shaft-b', 'shaft-a'], undefined, warnings)
    expect(warnings.some((w) => w.includes('T1') && w.includes('shaft opening'))).toBe(true)
  })
})
