import { describe, expect, it } from 'vitest'
import type { Floor } from '../floor/floor-types'
import { linkHubPair, relinkHub, setHubTrunk, unlinkHub } from './cross-floor-hub-link-writer'
import { twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

function floorsOf(overrides: { floor0?: Partial<Floor>; floor1?: Partial<Floor> } = {}): Floor[] {
  return twoFloorLinkedProject(overrides).floors
}

describe('linkHubPair', () => {
  it('links a fresh riser and drop symmetrically', () => {
    const floor0: Floor = { ...floorsOf()[0], hubs: [{ id: 'r', kind: 'riser', x: 0, y: 0, mountHeightM: 3 }] }
    const floor1: Floor = { ...floorsOf()[1], hubs: [{ id: 'd', kind: 'drop', x: 0, y: 0, mountHeightM: 0 }] }
    const next = linkHubPair([floor0, floor1], { floorId: 'floor-0', hubId: 'r' }, { floorId: 'floor-1', hubId: 'd' })
    expect(next[0].hubs[0].link).toEqual({ floorId: 'floor-1', hubId: 'd' })
    expect(next[1].hubs[0].link).toEqual({ floorId: 'floor-0', hubId: 'r' })
  })

  it('rejects a same-hub self-pair (no-op, same array); accepts either order for a valid fresh pair', () => {
    const floors = floorsOf()
    expect(linkHubPair(floors, { floorId: 'floor-0', hubId: 'riser-1' }, { floorId: 'floor-0', hubId: 'riser-1' })).toBe(floors)
    const freshFloors = floorsOf({ floor0: { hubs: [{ id: 'r', kind: 'riser', x: 0, y: 0, mountHeightM: 3 }] }, floor1: { hubs: [{ id: 'd', kind: 'drop', x: 0, y: 0, mountHeightM: 0 }] } })
    expect(linkHubPair(freshFloors, { floorId: 'floor-1', hubId: 'd' }, { floorId: 'floor-0', hubId: 'r' })).not.toBe(freshFloors) // valid either order
  })

  it('REGRESSION (item 3): already linked to EACH OTHER -> same array, no-op (trunks untouched)', () => {
    // The fixture's riser-1 <-> drop-1 pair is already linked; drop-1 also already carries its usual trunk.
    const floors = floorsOf()
    expect(linkHubPair(floors, { floorId: 'floor-0', hubId: 'riser-1' }, { floorId: 'floor-1', hubId: 'drop-1' })).toBe(floors)
    expect(linkHubPair(floors, { floorId: 'floor-1', hubId: 'drop-1' }, { floorId: 'floor-0', hubId: 'riser-1' })).toBe(floors) // either order
  })

  it('REGRESSION (item 4): rejects linking to a hub already linked to a THIRD point - never steals', () => {
    // drop-1 is already linked to riser-1. A fresh riser-2 on floor 0 must NOT be able to steal it.
    const base = floorsOf()
    const floors = [{ ...base[0], hubs: [...base[0].hubs, { id: 'riser-2', kind: 'riser' as const, x: 1, y: 1, mountHeightM: 3 }] }, base[1]]
    const next = linkHubPair(floors, { floorId: 'floor-0', hubId: 'riser-2' }, { floorId: 'floor-1', hubId: 'drop-1' })
    expect(next).toBe(floors) // rejected, same array
    expect(next[1].hubs.find((h) => h.id === 'drop-1')!.link).toEqual({ floorId: 'floor-0', hubId: 'riser-1' }) // still with its real partner
  })
})

describe('unlinkHub', () => {
  it('clears both sides and their trunks; no-op when not linked', () => {
    const floors = floorsOf()
    const next = unlinkHub(floors, { floorId: 'floor-0', hubId: 'riser-1' })
    expect(next[0].hubs[0].link).toBeUndefined()
    const drop = next[1].hubs.find((h) => h.id === 'drop-1')!
    expect(drop.link).toBeUndefined()
    expect(drop.trunk).toBeUndefined()
    expect(unlinkHub(next, { floorId: 'floor-0', hubId: 'riser-1' })).toBe(next)
  })
})

describe('relinkHub (item 4: the hub panel\'s "Linked to" picker, one step)', () => {
  it('switches to a different, unlinked partner in one pass: old partner unlinked + its trunk cleared, own trunk cleared, new link set', () => {
    const floors = floorsOf({ floor1: { hubs: [{ ...floorsOf()[1].hubs[0] }, { id: 'drop-2', kind: 'drop', x: 1, y: 1, mountHeightM: 0 }] } })
    const next = relinkHub(floors, { floorId: 'floor-0', hubId: 'riser-1' }, { floorId: 'floor-1', hubId: 'drop-2' })
    const oldPartner = next[1].hubs.find((h) => h.id === 'drop-1')!
    expect(oldPartner.link).toBeUndefined()
    expect(oldPartner.trunk).toBeUndefined() // old partner's trunk cleared too
    expect(next[0].hubs[0].link).toEqual({ floorId: 'floor-1', hubId: 'drop-2' })
    expect(next[1].hubs.find((h) => h.id === 'drop-2')!.link).toEqual({ floorId: 'floor-0', hubId: 'riser-1' })
  })

  it('newPartner: null unlinks; no-op (same array) when already unlinked', () => {
    const floors = floorsOf()
    const unlinked = relinkHub(floors, { floorId: 'floor-0', hubId: 'riser-1' }, null)
    expect(unlinked[0].hubs[0].link).toBeUndefined()
    expect(relinkHub(unlinked, { floorId: 'floor-0', hubId: 'riser-1' }, null)).toBe(unlinked)
  })

  it('no-op (same array) when re-selecting the CURRENT partner', () => {
    const floors = floorsOf()
    expect(relinkHub(floors, { floorId: 'floor-0', hubId: 'riser-1' }, { floorId: 'floor-1', hubId: 'drop-1' })).toBe(floors)
  })

  it('refuses (same array) when the new partner is already linked to someone else', () => {
    const floors = floorsOf({
      floor0: { hubs: [...floorsOf()[0].hubs, { id: 'riser-2', kind: 'riser', x: 1, y: 1, mountHeightM: 3 }] },
    })
    // riser-2 (unlinked) tries to steal drop-1, which already belongs to riser-1.
    const next = relinkHub(floors, { floorId: 'floor-0', hubId: 'riser-2' }, { floorId: 'floor-1', hubId: 'drop-1' })
    expect(next).toBe(floors)
  })

  it('BUG FIX: a refused switch leaves an ALREADY-LINKED hub linked to its OLD partner, not unlinked', () => {
    // riser-1 <-> drop-1 is already linked (the fixture). Add a THIRD point (riser-3 <-> drop-3,
    // already linked to each other) and try to switch riser-1 onto drop-3 - already taken.
    const riser3: { id: string; kind: 'riser'; x: number; y: number; mountHeightM: number; link: { floorId: string; hubId: string } } = {
      id: 'riser-3',
      kind: 'riser',
      x: 2,
      y: 2,
      mountHeightM: 3,
      link: { floorId: 'floor-1', hubId: 'drop-3' },
    }
    const drop3: { id: string; kind: 'drop'; x: number; y: number; mountHeightM: number; link: { floorId: string; hubId: string } } = {
      id: 'drop-3',
      kind: 'drop',
      x: 2,
      y: 2,
      mountHeightM: 0,
      link: { floorId: 'floor-0', hubId: 'riser-3' },
    }
    const floors = floorsOf({
      floor0: { hubs: [...floorsOf()[0].hubs, riser3] },
      floor1: { hubs: [...floorsOf()[1].hubs, drop3] },
    })
    const next = relinkHub(floors, { floorId: 'floor-0', hubId: 'riser-1' }, { floorId: 'floor-1', hubId: 'drop-3' })
    expect(next).toBe(floors) // the whole operation is refused, not just the new link
    expect(next[0].hubs.find((h) => h.id === 'riser-1')!.link).toEqual({ floorId: 'floor-1', hubId: 'drop-1' }) // still with its ORIGINAL partner
    expect(next[1].hubs.find((h) => h.id === 'drop-1')!.link).toEqual({ floorId: 'floor-0', hubId: 'riser-1' })
  })
})

describe('setHubTrunk', () => {
  it('sets and clears a trunk on a linked point; no-op when unlinked or self-targeting', () => {
    const floors = floorsOf()
    const cleared = setHubTrunk(floors, { floorId: 'floor-1', hubId: 'drop-1' }, null)
    expect(cleared[1].hubs[0].trunk).toBeUndefined()
    const reset = setHubTrunk(cleared, { floorId: 'floor-1', hubId: 'drop-1' }, { hubId: 'plain-hub-2', points: [{ x: 1, y: 1 }] })
    expect(reset[1].hubs[0].trunk).toEqual({ hubId: 'plain-hub-2', points: [{ x: 1, y: 1 }] })
    expect(setHubTrunk(floors, { floorId: 'floor-1', hubId: 'plain-hub-2' }, { hubId: 'drop-1', points: [] })).toBe(floors) // plain-hub-2 isn't linked
    expect(setHubTrunk(floors, { floorId: 'floor-1', hubId: 'drop-1' }, { hubId: 'drop-1', points: [] })).toBe(floors) // self
  })

  it('D1: refuses a trunk that targets a shaft marker, even from a shaft marker owner (no chaining into a shaft)', () => {
    const floors = floorsOf()
    const shaftMarker = { id: 'shaft-m', kind: 'shaft' as const, shaftId: 's1', x: 0, y: 0, mountHeightM: 0 }
    const withShaft = floors.map((f, i) => (i === 1 ? { ...f, hubs: [...f.hubs, shaftMarker] } : f))
    // Owner is a validly-linked drop - would otherwise be allowed to set a trunk.
    expect(setHubTrunk(withShaft, { floorId: 'floor-1', hubId: 'drop-1' }, { hubId: 'shaft-m', points: [] })).toBe(withShaft)
    // Owner is the shaft marker itself, targeting another hub that happens to be a DIFFERENT shaft's marker.
    const otherShaftMarker = { id: 'other-m', kind: 'shaft' as const, shaftId: 's2', x: 1, y: 1, mountHeightM: 0 }
    const withTwoShafts = withShaft.map((f, i) => (i === 1 ? { ...f, hubs: [...f.hubs, otherShaftMarker] } : f))
    expect(setHubTrunk(withTwoShafts, { floorId: 'floor-1', hubId: 'shaft-m' }, { hubId: 'other-m', points: [] })).toBe(withTwoShafts)
  })
})
