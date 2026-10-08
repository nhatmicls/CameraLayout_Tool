import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_HUBS } from '../domain/cable/cable-layout-types'
import type { PlanImage } from '../domain/project-file/project-types'
import { useEditorUiStore } from './editor-ui-store'
import { redoProject, undoProject, useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'

const store = () => useProjectStore.getState()
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length
const activeFloor = () => getActiveFloor(store())

const IMAGE_A: PlanImage = { dataUrl: 'data:image/png;base64,AAAA', widthPx: 1000, heightPx: 800, fileName: 'a.png' }
const IMAGE_B: PlanImage = { dataUrl: 'data:image/png;base64,BBBB', widthPx: 500, heightPx: 400, fileName: 'b.png' }

beforeEach(() => {
  store().resetProject()
  history().clear()
  useEditorUiStore.getState().clearSelection()
  useEditorUiStore.getState().setToolMode('select')
})

/** Floor 1 (active, image A) with a riser `riser-1`, floor 2 (image B) with a drop `drop-1` - unlinked. Returns both floor ids. */
function seedTwoFloorsWithUnlinkedPair(): { floor1Id: string; floor2Id: string } {
  store().setImage(IMAGE_A)
  const floor1Id = store().activeFloorId
  store().addHub({ id: 'riser-1', kind: 'riser', x: 50, y: 50, mountHeightM: 3 })
  store().addFloor('Floor 2')
  const floor2Id = store().activeFloorId
  store().setImage(IMAGE_B)
  store().addHub({ id: 'drop-1', kind: 'drop', x: 60, y: 60, mountHeightM: 0 })
  history().clear()
  return { floor1Id, floor2Id }
}

describe('linkHubs / unlinkHub', () => {
  it('links both sides in one undo step; undo restores unlinked', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    expect(steps()).toBe(1)
    const [floor1, floor2] = store().floors
    expect(floor1.hubs[0].link).toEqual({ floorId: floor2Id, hubId: 'drop-1' })
    expect(floor2.hubs[0].link).toEqual({ floorId: floor1Id, hubId: 'riser-1' })

    undoProject()
    expect(store().floors[0].hubs[0].link).toBeUndefined()
    expect(store().floors[1].hubs[0].link).toBeUndefined()
  })

  it('is a no-op (no undo step) for an illegal pair', () => {
    const { floor1Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor1Id, hubId: 'riser-1' }) // same hub
    expect(steps()).toBe(0)
  })

  it('REGRESSION (item 3): re-linking an already-linked-to-each-other pair is a no-op, no undo step', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    history().clear()

    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    expect(steps()).toBe(0)
    store().linkHubs({ floorId: floor2Id, hubId: 'drop-1' }, { floorId: floor1Id, hubId: 'riser-1' }) // either order
    expect(steps()).toBe(0)
  })

  it('REGRESSION (item 4): rejects linking to a hub already linked elsewhere - never steals', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    store().setActiveFloor(floor1Id)
    store().addHub({ id: 'riser-2', kind: 'riser', x: 10, y: 10, mountHeightM: 3 }) // a second, unlinked riser on floor 1
    history().clear()

    // riser-2 tries to steal drop-1, which already belongs to riser-1.
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-2' }, { floorId: floor2Id, hubId: 'drop-1' })
    expect(steps()).toBe(0)
    expect(store().floors.find((f) => f.id === floor2Id)!.hubs.find((h) => h.id === 'drop-1')!.link).toEqual({
      floorId: floor1Id,
      hubId: 'riser-1',
    })
  })

  it('unlinkHub clears both sides in one undo step; undo restores the link', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    history().clear()

    store().unlinkHub({ floorId: floor1Id, hubId: 'riser-1' })
    expect(steps()).toBe(1)
    expect(store().floors[0].hubs[0].link).toBeUndefined()
    expect(store().floors[1].hubs[0].link).toBeUndefined()

    undoProject()
    expect(store().floors[0].hubs[0].link).toEqual({ floorId: floor2Id, hubId: 'drop-1' })
  })
})

describe('relinkHub (item 4: the hub panel\'s "Linked to" select, one undo step)', () => {
  it('switches riser-1 from drop-1 to a fresh drop-2 in ONE undo step; undo restores drop-1', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    store().addHub({ id: 'drop-2', kind: 'drop', x: 70, y: 70, mountHeightM: 0 }) // on floor 2 (active)
    history().clear()

    store().relinkHub({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-2' })
    expect(steps()).toBe(1) // one write even though drop-1 unlinks AND drop-2 links

    const floors = store().floors
    expect(floors.find((f) => f.id === floor2Id)!.hubs.find((h) => h.id === 'drop-1')!.link).toBeUndefined()
    expect(floors.find((f) => f.id === floor2Id)!.hubs.find((h) => h.id === 'drop-2')!.link).toEqual({ floorId: floor1Id, hubId: 'riser-1' })
    expect(floors.find((f) => f.id === floor1Id)!.hubs[0].link).toEqual({ floorId: floor2Id, hubId: 'drop-2' })

    undoProject()
    expect(store().floors.find((f) => f.id === floor2Id)!.hubs.find((h) => h.id === 'drop-1')!.link).toEqual({ floorId: floor1Id, hubId: 'riser-1' })
  })

  it('newPartner null unlinks in one step', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    history().clear()

    store().relinkHub({ floorId: floor1Id, hubId: 'riser-1' }, null)
    expect(steps()).toBe(1)
    expect(store().floors.find((f) => f.id === floor2Id)!.hubs[0].link).toBeUndefined()
  })
})

describe('setHubTrunk', () => {
  it('sets and clears a trunk on a linked point, one undo step each; undo restores', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    store().addHub({ id: 'target-hub', x: 90, y: 90, mountHeightM: 1.5 }) // on floor 2 (still active)
    history().clear()

    store().setHubTrunk({ floorId: floor2Id, hubId: 'drop-1' }, { hubId: 'target-hub', points: [{ x: 1, y: 1 }] })
    expect(steps()).toBe(1)
    expect(store().floors[1].hubs.find((h) => h.id === 'drop-1')!.trunk).toEqual({ hubId: 'target-hub', points: [{ x: 1, y: 1 }] })

    store().setHubTrunk({ floorId: floor2Id, hubId: 'drop-1' }, null)
    expect(steps()).toBe(2)
    expect(store().floors[1].hubs.find((h) => h.id === 'drop-1')!.trunk).toBeUndefined()

    undoProject()
    expect(store().floors[1].hubs.find((h) => h.id === 'drop-1')!.trunk).toEqual({ hubId: 'target-hub', points: [{ x: 1, y: 1 }] })
  })

  it('is a no-op on an unlinked point', () => {
    seedTwoFloorsWithUnlinkedPair()
    const { floor2Id } = { floor2Id: store().activeFloorId }
    store().setHubTrunk({ floorId: floor2Id, hubId: 'drop-1' }, { hubId: 'drop-1', points: [] })
    expect(steps()).toBe(0)
  })
})

describe('createPairedHub', () => {
  it('creates the paired point and links both, ONE undo step; undo removes the point and the link', () => {
    store().setImage(IMAGE_A)
    const floor1Id = store().activeFloorId
    store().addHub({ id: 'riser-1', kind: 'riser', x: 50, y: 50, mountHeightM: 3 })
    store().addFloor('Floor 2')
    const floor2Id = store().activeFloorId
    store().setImage(IMAGE_B)
    store().setActiveFloor(floor1Id)
    history().clear()

    const before = steps()
    const result = store().createPairedHub({ floorId: floor1Id, hubId: 'riser-1' }, 'new-drop')
    expect(result).toEqual({ ok: true })
    expect(steps()).toBe(before + 1)

    const floor2 = store().floors.find((f) => f.id === floor2Id)!
    expect(floor2.hubs).toHaveLength(1)
    expect(floor2.hubs[0]).toMatchObject({ id: 'new-drop', kind: 'drop' })
    expect(activeFloor().hubs[0].link).toEqual({ floorId: floor2Id, hubId: 'new-drop' })

    undoProject()
    expect(store().floors.find((f) => f.id === floor2Id)!.hubs).toEqual([])
    expect(activeFloor().hubs[0].link).toBeUndefined()
  })

  it('refuses with a reason and makes no undo step: no floor above, no image, at MAX_HUBS', () => {
    store().setImage(IMAGE_A)
    const floor1Id = store().activeFloorId
    store().addHub({ id: 'riser-top', kind: 'riser', x: 1, y: 1, mountHeightM: 3 })
    history().clear()

    const topFloorResult = store().createPairedHub({ floorId: floor1Id, hubId: 'riser-top' }, 'x')
    expect(topFloorResult).toMatchObject({ ok: false, problem: expect.stringContaining('above') })
    expect(steps()).toBe(0)

    store().addFloor('Floor 2') // no image yet
    const floor2Id = store().activeFloorId
    store().setActiveFloor(floor1Id)
    history().clear()
    const noImageResult = store().createPairedHub({ floorId: floor1Id, hubId: 'riser-top' }, 'x')
    expect(noImageResult).toMatchObject({ ok: false, problem: expect.stringContaining('no plan image') })
    expect(steps()).toBe(0)

    store().setActiveFloor(floor2Id)
    store().setImage(IMAGE_B)
    for (let i = 0; i < MAX_HUBS; i++) store().addHub({ id: `filler-${i}`, x: 0, y: 0, mountHeightM: 1.5 })
    store().setActiveFloor(floor1Id)
    history().clear()
    const maxHubsResult = store().createPairedHub({ floorId: floor1Id, hubId: 'riser-top' }, 'x')
    expect(maxHubsResult).toMatchObject({ ok: false, problem: expect.stringContaining('maximum') })
    expect(steps()).toBe(0)
  })
})

describe('item 6: undo/redo auto-switch when exactly TWO floors changed (a link touches both sides)', () => {
  /** Floor 1 (riser), floor 2 (drop, unlinked), floor 3 (unrelated, no hubs). Floor 3 stays active. */
  function seedThreeFloorsActiveOnThird(): { floor1Id: string; floor2Id: string; floor3Id: string } {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().addFloor('Floor 3')
    const floor3Id = store().activeFloorId
    store().setImage({ ...IMAGE_B, fileName: 'c.png' })
    history().clear()
    return { floor1Id, floor2Id, floor3Id }
  }

  it('stays put when the active floor IS one of the two changed floors', () => {
    const { floor1Id, floor2Id } = seedThreeFloorsActiveOnThird()
    store().setActiveFloor(floor2Id) // one of the two floors the link is about to touch
    history().clear()

    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    expect(store().activeFloorId).toBe(floor2Id) // forward edits never auto-switch at all

    undoProject()
    expect(store().activeFloorId).toBe(floor2Id) // still on floor 2 - one of the two changed floors
  })

  it('switches to the LOWER-index changed floor when the active floor is NEITHER', () => {
    const { floor1Id, floor2Id, floor3Id } = seedThreeFloorsActiveOnThird()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    expect(store().activeFloorId).toBe(floor3Id) // forward edits never auto-switch

    undoProject() // undoes the link: floor1 (index 0) and floor2 (index 1) both change content
    expect(store().activeFloorId).toBe(floor1Id) // lower index of the two, since floor 3 (active) was neither

    redoProject()
    expect(store().activeFloorId).toBe(floor1Id) // same rule applies to redo
  })
})

describe('cascades run in the SAME set() as their cause (one undo step)', () => {
  it('deleting the partner hub (on a different floor than the one being edited) prunes the surviving side', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    store().setActiveFloor(floor2Id) // deleteHub always acts on the ACTIVE floor
    history().clear()

    store().deleteHub('drop-1')
    expect(steps()).toBe(1) // delete + prune of the OTHER floor's link, one step
    expect(store().floors.find((f) => f.id === floor1Id)!.hubs[0].link).toBeUndefined()

    undoProject()
    expect(store().floors.find((f) => f.id === floor1Id)!.hubs[0].link).toEqual({ floorId: floor2Id, hubId: 'drop-1' })
  })

  it('setImage on the linked floor prunes the partner floor too, one undo step', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    store().setActiveFloor(floor2Id)
    history().clear()

    store().setImage({ ...IMAGE_B, fileName: 'replacement.png' })
    expect(steps()).toBe(1)
    expect(store().floors.find((f) => f.id === floor1Id)!.hubs[0].link).toBeUndefined()
  })

  it('deleteFloor prunes a surviving floor\'s link to the deleted one, one undo step', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    history().clear()

    store().deleteFloor(floor2Id)
    expect(steps()).toBe(1)
    expect(store().floors.find((f) => f.id === floor1Id)!.hubs[0].link).toBeUndefined()
  })

  it('moveFloor prunes a link that is no longer adjacent, one undo step', () => {
    const { floor1Id, floor2Id } = seedTwoFloorsWithUnlinkedPair()
    store().linkHubs({ floorId: floor1Id, hubId: 'riser-1' }, { floorId: floor2Id, hubId: 'drop-1' })
    store().addFloor('Floor 3') // becomes floors[2], active
    store().setImage({ ...IMAGE_B, fileName: 'c.png' })
    history().clear()

    // Move floor 3 to the middle (index 1): floor 1's riser is no longer adjacent to floor 2's drop.
    store().moveFloor(store().activeFloorId, 1)
    expect(steps()).toBe(1)
    expect(store().floors.find((f) => f.id === floor1Id)!.hubs[0].link).toBeUndefined()
    expect(store().floors.find((f) => f.id === floor2Id)!.hubs[0].link).toBeUndefined()
  })
})
