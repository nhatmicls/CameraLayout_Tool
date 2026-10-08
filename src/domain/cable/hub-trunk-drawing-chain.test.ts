import { describe, expect, it } from 'vitest'
import { advanceHubTrunkDrawingChain, removeLastHubTrunkDrawingPoint, type HubTrunkDrawingChain } from './hub-trunk-drawing-chain'
import { MAX_CABLE_POINTS } from './cable-layout-types'

const EMPTY: HubTrunkDrawingChain = { startHubId: 'hub-start', points: [] }

describe('advanceHubTrunkDrawingChain', () => {
  it('adds a free click (not on a hub) as a vertex', () => {
    expect(advanceHubTrunkDrawingChain(EMPTY, { x: 10, y: 20, hubId: null })).toEqual({
      kind: 'continue',
      chain: { startHubId: 'hub-start', points: [{ x: 10, y: 20 }] },
    })
  })

  it('a click on a device marker is never a target: same as a free click (hubId null)', () => {
    // The caller (geometric snap restricted to hubs) never reports a device as `hubId`, so a
    // click near one always arrives here with `hubId: null` - just another vertex.
    const step = advanceHubTrunkDrawingChain(EMPTY, { x: 30, y: 30, hubId: null })
    expect(step.kind).toBe('continue')
  })

  it('commits on a click that snaps to another hub', () => {
    const chain: HubTrunkDrawingChain = { startHubId: 'hub-start', points: [{ x: 10, y: 20 }] }
    expect(advanceHubTrunkDrawingChain(chain, { x: 100, y: 100, hubId: 'hub-target' })).toEqual({
      kind: 'commit',
      hubId: 'hub-target',
      points: [{ x: 10, y: 20 }],
    })
  })

  it('ignores a click that snaps back to the start hub itself', () => {
    const chain: HubTrunkDrawingChain = { startHubId: 'hub-start', points: [{ x: 10, y: 20 }] }
    expect(advanceHubTrunkDrawingChain(chain, { x: 0, y: 0, hubId: 'hub-start' })).toEqual({
      kind: 'ignored',
      chain,
      reason: 'start-hub',
    })
  })

  it('ignores a repeat click closer than 1px to the previous vertex', () => {
    const chain: HubTrunkDrawingChain = { startHubId: 'hub-start', points: [{ x: 100, y: 100 }] }
    expect(advanceHubTrunkDrawingChain(chain, { x: 100.5, y: 100, hubId: null })).toMatchObject({ kind: 'ignored', reason: 'repeat-point' })
  })

  it('caps at MAX_CABLE_POINTS vertices (a hub click still commits past the cap)', () => {
    const full: HubTrunkDrawingChain = { startHubId: 'hub-start', points: Array.from({ length: MAX_CABLE_POINTS }, (_, i) => ({ x: i, y: i })) }
    expect(advanceHubTrunkDrawingChain(full, { x: 9999, y: 9999, hubId: null })).toMatchObject({ kind: 'ignored', reason: 'too-many-points' })
    expect(advanceHubTrunkDrawingChain(full, { x: 700, y: 500, hubId: 'hub-target' }).kind).toBe('commit')
  })
})

describe('removeLastHubTrunkDrawingPoint', () => {
  it('drops the last vertex', () => {
    const chain: HubTrunkDrawingChain = { startHubId: 'hub-start', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }
    expect(removeLastHubTrunkDrawingPoint(chain)).toEqual({ startHubId: 'hub-start', points: [{ x: 1, y: 1 }] })
  })

  it('is a no-op on an empty chain', () => {
    expect(removeLastHubTrunkDrawingPoint(EMPTY)).toBe(EMPTY)
  })
})
