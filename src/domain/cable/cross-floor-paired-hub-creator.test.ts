import { describe, expect, it } from 'vitest'
import type { Floor } from '../floor/floor-types'
import { MAX_HUBS } from './cable-layout-types'
import { createPairedHub, pairedHubRefusalReason } from './cross-floor-paired-hub-creator'
import { DUMMY_IMAGE, twoFloorLinkedProject } from './cross-floor-worked-example.test-fixtures'

function floorsOf(overrides: { floor0?: Partial<Floor>; floor1?: Partial<Floor> } = {}): Floor[] {
  return twoFloorLinkedProject(overrides).floors
}

describe('createPairedHub', () => {
  it('creates the opposite kind at the clamped position and links both, one new array', () => {
    const floor0: Floor = { ...floorsOf()[0], hubs: [{ id: 'r', kind: 'riser', x: 9999, y: 9999, mountHeightM: 3 }], image: DUMMY_IMAGE }
    const floor1: Floor = { ...floorsOf()[1], hubs: [], image: { ...DUMMY_IMAGE, widthPx: 500, heightPx: 500 } }
    const result = createPairedHub([floor0, floor1], { floorId: 'floor-0', hubId: 'r' }, 'new-drop', 3)
    if ('problem' in result) throw new Error(result.problem)
    const paired = result.floors[1].hubs[0]
    expect(paired).toMatchObject({ id: 'new-drop', kind: 'drop', x: 500, y: 500, mountHeightM: 0 }) // clamped to the smaller plan
    expect(paired.link).toEqual({ floorId: 'floor-0', hubId: 'r' })
    expect(result.floors[0].hubs[0].link).toEqual({ floorId: 'floor-1', hubId: 'new-drop' })
  })

  it('a paired riser gets the given default mount height', () => {
    const floor0: Floor = { ...floorsOf()[0], hubs: [] }
    const floor1: Floor = { ...floorsOf()[1], hubs: [{ id: 'd', kind: 'drop', x: 1, y: 1, mountHeightM: 0 }] }
    const result = createPairedHub([floor0, floor1], { floorId: 'floor-1', hubId: 'd' }, 'new-riser', 4.2)
    if ('problem' in result) throw new Error(result.problem)
    expect(result.floors[0].hubs[0]).toMatchObject({ kind: 'riser', mountHeightM: 4.2 })
  })

  it('refuses: no floor in that direction, no image, at MAX_HUBS, already linked', () => {
    const floors = floorsOf()
    expect(createPairedHub(floors, { floorId: 'floor-1', hubId: 'plain-hub-2' }, 'x', 3)).toMatchObject({ problem: expect.any(String) }) // not riser/drop

    const unlinkedTopFloorRiser: Floor = { ...floors[1], hubs: [...floors[1].hubs, { id: 'riser-top', kind: 'riser', x: 1, y: 1, mountHeightM: 3 }] }
    expect(createPairedHub([floors[0], unlinkedTopFloorRiser], { floorId: 'floor-1', hubId: 'riser-top' }, 'x', 3)).toMatchObject({
      problem: expect.stringContaining('above'),
    }) // top floor, nothing above it

    const floor0UnlinkedRiser: Floor = { ...floorsOf()[0], hubs: [{ id: 'r2', kind: 'riser', x: 0, y: 0, mountHeightM: 3 }] }

    const imagelessPartner: Floor = { ...floorsOf()[1], image: null }
    expect(createPairedHub([floor0UnlinkedRiser, imagelessPartner], { floorId: 'floor-0', hubId: 'r2' }, 'x', 3)).toMatchObject({
      problem: expect.stringContaining('no plan image'),
    })

    const fullPartner: Floor = { ...floorsOf()[1], hubs: Array.from({ length: MAX_HUBS }, (_, i) => ({ id: `h${i}`, x: 0, y: 0, mountHeightM: 1.5 })) }
    expect(createPairedHub([floor0UnlinkedRiser, fullPartner], { floorId: 'floor-0', hubId: 'r2' }, 'x', 3)).toMatchObject({
      problem: expect.stringContaining('maximum'),
    })

    expect(createPairedHub(floors, { floorId: 'floor-0', hubId: 'riser-1' }, 'x', 3)).toMatchObject({ problem: expect.stringContaining('Already linked') })
  })
})

describe('pairedHubRefusalReason', () => {
  it('matches createPairedHub\'s own refusal exactly, null when allowed', () => {
    const floors = floorsOf()
    const floor0UnlinkedRiser: Floor = { ...floors[0], hubs: [{ id: 'r2', kind: 'riser', x: 0, y: 0, mountHeightM: 3 }] }
    expect(pairedHubRefusalReason([floor0UnlinkedRiser, floors[1]], { floorId: 'floor-0', hubId: 'r2' })).toBeNull()
    expect(pairedHubRefusalReason(floors, { floorId: 'floor-0', hubId: 'riser-1' })).toContain('Already linked')
  })
})
