import { describe, expect, it } from 'vitest'
import { acceptedSnapKind, advanceCableDrawingChain, excludedSnapDevice, removeLastCableDrawingPoint, type CableDrawingChain } from './cable-drawing-chain'
import { buildCableEndpointIndex } from './cable-endpoint-index'
import { MAX_CABLE_POINTS } from './cable-layout-types'
import { findNearestCableSnapTarget, type CableSnapTarget } from './cable-snap-target-lookup'
import { BEAM_S2, CAMERA_C1, CAMERA_C2, HUB_H1 } from './cable-worked-example.test-fixtures'

const index = buildCableEndpointIndex([CAMERA_C1, CAMERA_C2], [BEAM_S2], [HUB_H1])

describe('findNearestCableSnapTarget', () => {
  it('finds a target inside the tolerance and nothing outside it', () => {
    expect(findNearestCableSnapTarget(105, 100, index, 10, 'any')).toMatchObject({ kind: 'device', label: 'C1' })
    expect(findNearestCableSnapTarget(111, 100, index, 10, 'any')).toBeNull()
  })

  it('never returns the excluded device, even when it is the nearest', () => {
    expect(findNearestCableSnapTarget(100, 110, index, 500, 'any', { kind: 'camera', id: 'cam-1' })).toMatchObject({ label: 'C2' })
    expect(findNearestCableSnapTarget(100, 100, index, 10, 'any', { kind: 'camera', id: 'cam-1' })).toBeNull()
  })

  it('picks the nearer of two targets', () => {
    expect(findNearestCableSnapTarget(100, 210, index, 200, 'any')).toMatchObject({ label: 'C2' })
  })

  it('resolves a tie to the camera before the hub', () => {
    const tied = buildCableEndpointIndex([{ ...CAMERA_C1, x: 0, y: 0 }], [], [{ ...HUB_H1, x: 20, y: 0 }])
    expect(findNearestCableSnapTarget(10, 0, tied, 10, 'any')).toMatchObject({ kind: 'device' })
  })

  it('returns the rx end of a beam with its end name', () => {
    expect(findNearestCableSnapTarget(500, 601, index, 5, 'any')).toMatchObject({
      kind: 'device',
      ref: { kind: 'sensor', id: 'beam-1', end: 'rx' },
      label: 'S1rx',
    })
  })

  it("skips a nearer camera when only a hub is accepted, and the reverse", () => {
    const near = buildCableEndpointIndex([{ ...CAMERA_C1, x: 0, y: 0 }], [], [{ ...HUB_H1, x: 30, y: 0 }])
    expect(findNearestCableSnapTarget(5, 0, near, 50, 'hub')).toMatchObject({ kind: 'hub', hubId: 'hub-1' })
    expect(findNearestCableSnapTarget(28, 0, near, 50, 'device')).toMatchObject({ kind: 'device' })
  })

  it('returns null for a non-finite or non-positive tolerance', () => {
    expect(findNearestCableSnapTarget(100, 100, index, 0, 'any')).toBeNull()
    expect(findNearestCableSnapTarget(100, 100, index, Number.NaN, 'any')).toBeNull()
  })
})

const camera: CableSnapTarget = { kind: 'device', ref: { kind: 'camera', id: 'cam-1' }, x: 100, y: 100, label: 'C1' }
const otherCamera: CableSnapTarget = { kind: 'device', ref: { kind: 'camera', id: 'cam-2' }, x: 100, y: 300, label: 'C2' }
const hub: CableSnapTarget = { kind: 'hub', hubId: 'hub-1', x: 700, y: 500, label: 'H1' }

function continued(chain: CableDrawingChain | null, x: number, y: number, snapTarget: CableSnapTarget | null = null): CableDrawingChain {
  const step = advanceCableDrawingChain(chain, { x, y, snapTarget })
  if (step.kind !== 'continue') throw new Error(`expected continue, got ${step.kind}`)
  return step.chain
}

describe('advanceCableDrawingChain', () => {
  it('ignores a first click on a free point', () => {
    expect(advanceCableDrawingChain(null, { x: 5, y: 5, snapTarget: null })).toEqual({ kind: 'ignored', chain: null, reason: 'start-needs-target' })
  })

  it('accepts anything to start; after a device, a hub or any other device; after a hub, a device', () => {
    expect(acceptedSnapKind(null)).toBe('any')
    expect(acceptedSnapKind({ start: camera, points: [] })).toBe('any')
    expect(acceptedSnapKind({ start: hub, points: [] })).toBe('device')
    expect(excludedSnapDevice(null)).toBeUndefined()
    expect(excludedSnapDevice({ start: camera, points: [] })).toEqual({ kind: 'camera', id: 'cam-1' })
    expect(excludedSnapDevice({ start: hub, points: [] })).toBeUndefined()
  })

  it('commits device -> 2 vertices -> hub in click order', () => {
    let chain = continued(null, 100, 100, camera)
    chain = continued(chain, 400, 100)
    chain = continued(chain, 400, 500)
    expect(advanceCableDrawingChain(chain, { x: 700, y: 500, snapTarget: hub })).toEqual({
      kind: 'commit',
      cable: { device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', points: [{ x: 400, y: 100 }, { x: 400, y: 500 }] },
    })
  })

  it('commits hub -> vertices -> device REVERSED, so stored order is device -> hub', () => {
    let chain = continued(null, 700, 500, hub)
    chain = continued(chain, 400, 500)
    chain = continued(chain, 400, 100)
    expect(advanceCableDrawingChain(chain, { x: 100, y: 100, snapTarget: camera })).toEqual({
      kind: 'commit',
      cable: { device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', points: [{ x: 400, y: 100 }, { x: 400, y: 500 }] },
    })
  })

  it('commits a direct cable with no vertices', () => {
    const chain = continued(null, 100, 100, camera)
    expect(advanceCableDrawingChain(chain, { x: 700, y: 500, snapTarget: hub })).toMatchObject({ kind: 'commit', cable: { points: [] } })
  })

  it('commits device -> another device as a device-end cable, in click order', () => {
    const chain = continued(continued(null, 100, 100, camera), 50, 200)
    expect(advanceCableDrawingChain(chain, { x: 100, y: 300, snapTarget: otherCamera })).toEqual({
      kind: 'commit',
      cable: { device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-2' }, points: [{ x: 50, y: 200 }] },
    })
  })

  it('never ends a cable on its own start device, and never joins two hubs: both are plain vertices', () => {
    const onItself = advanceCableDrawingChain(continued(null, 100, 100, camera), { x: 101, y: 103, snapTarget: camera })
    expect(onItself.kind).toBe('continue')
    const hubToHub = advanceCableDrawingChain(continued(null, 700, 500, hub), { x: 10, y: 10, snapTarget: { ...hub, hubId: 'hub-2' } as typeof hub })
    expect(hubToHub.kind).toBe('continue')
  })

  it('ignores a point repeated within 1 px (of the start or of the previous vertex)', () => {
    const started = continued(null, 100, 100, camera)
    expect(advanceCableDrawingChain(started, { x: 100.5, y: 100, snapTarget: null })).toMatchObject({ kind: 'ignored', reason: 'repeat-point' })
    const chain = continued(started, 200, 100)
    expect(advanceCableDrawingChain(chain, { x: 200, y: 100.5, snapTarget: null })).toMatchObject({ kind: 'ignored', reason: 'repeat-point', chain })
  })

  it('stops adding vertices at the cap but can still commit', () => {
    const full: CableDrawingChain = { start: camera, points: Array.from({ length: MAX_CABLE_POINTS }, (_, i) => ({ x: i * 2, y: 0 })) }
    expect(advanceCableDrawingChain(full, { x: 9999, y: 9999, snapTarget: null })).toMatchObject({ kind: 'ignored', reason: 'too-many-points' })
    expect(advanceCableDrawingChain(full, { x: 700, y: 500, snapTarget: hub }).kind).toBe('commit')
  })
})

describe('removeLastCableDrawingPoint', () => {
  it('drops the last vertex and is a no-op on an empty chain', () => {
    const empty: CableDrawingChain = { start: camera, points: [] }
    expect(removeLastCableDrawingPoint(empty)).toBe(empty)
    expect(removeLastCableDrawingPoint({ start: camera, points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }).points).toEqual([{ x: 1, y: 1 }])
  })
})
