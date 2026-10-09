import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_SHAFTS } from '../domain/cable/cable-layout-types'
import type { PlanImage } from '../domain/project-file/project-types'
import { useEditorUiStore } from './editor-ui-store'
import { redoProject, undoProject, useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'

const store = () => useProjectStore.getState()
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length
const IMAGE_A: PlanImage = { dataUrl: 'data:image/png;base64,AAAA', widthPx: 1000, heightPx: 800, fileName: 'a.png' }
const IMAGE_B: PlanImage = { dataUrl: 'data:image/png;base64,BBBB', widthPx: 500, heightPx: 400, fileName: 'b.png' }
const IMAGE_C: PlanImage = { dataUrl: 'data:image/png;base64,CCCC', widthPx: 600, heightPx: 600, fileName: 'c.png' }

beforeEach(() => {
  store().resetProject()
  history().clear()
  useEditorUiStore.getState().clearSelection()
  useEditorUiStore.getState().setToolMode('select')
})

/** 3 floors, each with an image (F1 active first, then F2, F3 added in order). Returns their ids in floor order. */
function seedThreeFloorsWithImages(): string[] {
  store().setImage(IMAGE_A)
  const f1 = store().activeFloorId
  store().addFloor('F2')
  store().setImage(IMAGE_B)
  const f2 = store().activeFloorId
  store().addFloor('F3')
  store().setImage(IMAGE_C)
  const f3 = store().activeFloorId
  store().setActiveFloor(f1)
  history().clear()
  return [f1, f2, f3]
}

describe('createShaft', () => {
  it('places one marker on every floor in the range, one undo step', () => {
    seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.skippedFloorNames).toEqual([])
    expect(store().shafts).toEqual([{ id: result.shaftId, name: 'Main shaft' }])
    expect(store().floors.every((floor) => floor.hubs.some((hub) => hub.kind === 'shaft' && hub.shaftId === result.shaftId))).toBe(true)
    expect(steps()).toBe(1)
  })

  it('a narrower range only opens on those floors; the rest have none', () => {
    const [f1] = seedThreeFloorsWithImages()
    const result = store().createShaft('Partial', 0, 1, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const floorsById = new Map(store().floors.map((floor) => [floor.id, floor]))
    expect(floorsById.get(f1)!.hubs.some((hub) => hub.shaftId === result.shaftId)).toBe(true)
    expect(store().floors[2].hubs.some((hub) => hub.shaftId === result.shaftId)).toBe(false)
  })

  it('names a skipped floor (no image) instead of silently dropping it', () => {
    seedThreeFloorsWithImages()
    store().addFloor('F4') // no image yet
    const result = store().createShaft('X', 0, 3, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    expect(result.skippedFloorNames).toEqual(['F4 (no plan image)'])
  })

  it('is refused at MAX_SHAFTS, no undo step', () => {
    seedThreeFloorsWithImages()
    for (let i = 0; i < MAX_SHAFTS; i++) store().createShaft(`S${i}`, 0, 0, { x: 1, y: 1 })
    history().clear()
    const result = store().createShaft('overflow', 0, 0, { x: 1, y: 1 })
    expect(result.ok).toBe(false)
    expect(steps()).toBe(0)
  })

  it('undo removes the shaft and every marker it created', () => {
    seedThreeFloorsWithImages()
    store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    undoProject()
    expect(store().shafts).toEqual([])
    expect(store().floors.every((floor) => !floor.hubs.some((hub) => hub.kind === 'shaft'))).toBe(true)
  })

  it('C2: is refused (no set(), no undo step, not appended to shafts[]) when EVERY floor in range is skipped', () => {
    seedThreeFloorsWithImages()
    store().addFloor('F4') // no image yet - the only floor "in range" below
    const newFloorId = store().activeFloorId
    history().clear()
    const shaftsBefore = store().shafts

    const result = store().createShaft('Doomed', 3, 3, { x: 1, y: 1 }) // range = just F4, which has no image
    expect(result.ok).toBe(false)
    expect(steps()).toBe(0)
    expect(store().shafts).toBe(shaftsBefore) // not appended
    expect(store().floors.find((f) => f.id === newFloorId)!.hubs).toEqual([])
  })
})

describe('addShaftOpening / renameShaft', () => {
  it('adds one more marker on a floor that had none', () => {
    const [f1, , f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 0, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const added = store().addShaftOpening(result.shaftId, 2, { x: 5, y: 5 })
    expect(added.ok).toBe(true)
    const f3Floor = store().floors.find((floor) => floor.id === f3)!
    expect(f3Floor.hubs.some((hub) => hub.shaftId === result.shaftId)).toBe(true)
    expect(f1).toBeTruthy() // f1 unused beyond destructuring
  })

  it('M2: refuses a floor that already has a marker of this SAME shaft - never creates a duplicate', () => {
    const [f1] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 0, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    history().clear()
    const refusal = store().addShaftOpening(result.shaftId, 0, { x: 20, y: 20 }) // F1 (index 0) already has one
    expect(refusal.ok).toBe(false)
    expect(steps()).toBe(0)
    const f1Floor = store().floors.find((f) => f.id === f1)!
    expect(f1Floor.hubs.filter((h) => h.kind === 'shaft' && h.shaftId === result.shaftId)).toHaveLength(1)
  })

  it('refuses an unknown shaft id', () => {
    seedThreeFloorsWithImages()
    const result = store().addShaftOpening('ghost', 0, { x: 1, y: 1 })
    expect(result.ok).toBe(false)
  })

  it('renameShaft trims and no-ops on empty/unchanged', () => {
    seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 0, { x: 1, y: 1 })
    if (!result.ok) throw new Error('unreachable')
    history().clear()
    store().renameShaft(result.shaftId, '  Renamed  ')
    expect(store().shafts[0].name).toBe('Renamed')
    expect(steps()).toBe(1)
    store().renameShaft(result.shaftId, '   ')
    expect(store().shafts[0].name).toBe('Renamed') // empty name ignored, no-op
    expect(steps()).toBe(1)
  })
})

describe('deleteShaft', () => {
  it('removes every marker, their cables, and the shafts[] entry in one undo step; undo restores', () => {
    seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    history().clear()
    store().deleteShaft(result.shaftId)
    expect(store().shafts).toEqual([])
    expect(store().floors.every((floor) => !floor.hubs.some((hub) => hub.kind === 'shaft'))).toBe(true)
    expect(steps()).toBe(1)
    undoProject()
    expect(store().shafts).toEqual([{ id: result.shaftId, name: 'Main shaft' }])
    expect(store().floors.every((floor) => floor.hubs.some((hub) => hub.shaftId === result.shaftId))).toBe(true)
  })
})

describe('deleteHub cascades on a shaft marker', () => {
  it('deleting the last marker removes the shaft from shafts[], same undo step', () => {
    seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 0, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    history().clear()
    const marker = getActiveFloor(store()).hubs.find((hub) => hub.kind === 'shaft')!
    store().deleteHub(marker.id)
    expect(store().shafts).toEqual([])
    expect(steps()).toBe(1)
  })

})

describe('undo/redo auto-switch when MANY floors changed (shaft create/delete)', () => {
  it('stays put when the active floor is among the ones the shaft just touched', () => {
    const [f1, f2] = seedThreeFloorsWithImages()
    store().setActiveFloor(f2) // one of the three floors the shaft is about to open onto
    history().clear()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    expect(store().activeFloorId).toBe(f2) // forward edits never auto-switch at all

    undoProject()
    expect(store().activeFloorId).toBe(f2) // still F2 - one of the three changed floors
    expect(f1).toBeTruthy()
  })

  it('switches to the LOWEST-index changed floor when the active floor is none of them', () => {
    const [f1, , f3] = seedThreeFloorsWithImages()
    store().setActiveFloor(f3)
    const result = store().createShaft('Narrow shaft', 0, 1, { x: 10, y: 10 }) // only F1 and F2
    if (!result.ok) throw new Error('unreachable')
    expect(store().activeFloorId).toBe(f3) // forward edits never auto-switch

    undoProject() // undoes the shaft: F1 and F2 both lose their marker, F3 (active) is neither
    expect(store().activeFloorId).toBe(f1) // lowest index among the two changed floors

    redoProject()
    expect(store().activeFloorId).toBe(f1) // same rule applies to redo
  })
})

describe('setCableShaftLeg - a cable\'s own route beyond its shaft', () => {
  /** A shaft through F1 + F2, a hub and a camera on F1, and one camera cable on F2 ending on F2's opening. Returns the ids the tests need. */
  function seedShaftCable() {
    const [f1, f2, f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 1, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const f1Marker = store().floors.find((f) => f.id === f1)!.hubs.find((h) => h.kind === 'shaft')!
    const f2Marker = store().floors.find((f) => f.id === f2)!.hubs.find((h) => h.kind === 'shaft')!
    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 700, mountHeightM: 1.5 })
    store().addCamera({ id: 'cam-end', modelId: 'm', x: 500, y: 500, rotationDeg: 0, rangeM: 5 })
    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: f2Marker.id, typeId: store().cableTypes[0].id, points: [] })
    history().clear()
    return { f1, f2, f3, f1Marker, f2Marker }
  }
  const cableOn = (floorId: string) => store().floors.find((f) => f.id === floorId)!.cables[0]

  it('sets a route to a hub on another floor from a DIFFERENT active floor, one undo step; removes it again', () => {
    const { f1, f2 } = seedShaftCable()
    store().setActiveFloor(f1) // the route is drawn while viewing the exit floor; the cable lives on F2
    const leg = { floorId: f1, points: [{ x: 50, y: 60 }], hubId: 'h1' }
    expect(store().setCableShaftLeg(f2, 'cable-1', leg)).toBe(true)
    expect(cableOn(f2).beyondShaft).toEqual(leg)
    expect(steps()).toBe(1)

    expect(store().setCableShaftLeg(f2, 'cable-1', null)).toBe(true)
    expect(cableOn(f2)).not.toHaveProperty('beyondShaft')
    expect(steps()).toBe(2)
    undoProject()
    expect(cableOn(f2).beyondShaft).toEqual(leg)
  })

  it('undo / redo of a route drawn while viewing the exit floor STAYS there (the line is on that floor), but switches from any other floor', () => {
    const { f1, f2, f3 } = seedShaftCable()
    store().setActiveFloor(f1)
    store().setCableShaftLeg(f2, 'cable-1', { floorId: f1, points: [], hubId: 'h1' })
    undoProject()
    expect(store().activeFloorId).toBe(f1)
    redoProject()
    expect(store().activeFloorId).toBe(f1)

    store().setActiveFloor(f3) // neither the exit floor nor the cable's own floor
    undoProject()
    expect(store().activeFloorId).toBe(f2) // the ordinary rule: the one floor whose content changed
  })

  it('sets a route that ends on a device of the exit floor', () => {
    const { f1, f2 } = seedShaftCable()
    expect(store().setCableShaftLeg(f2, 'cable-1', { floorId: f1, points: [], endDevice: { kind: 'camera', id: 'cam-end' } })).toBe(true)
    expect(cableOn(f2).beyondShaft?.endDevice).toEqual({ kind: 'camera', id: 'cam-end' })
  })

  it('refuses, with no undo step: an unknown cable, a floor with no opening of that shaft, a shaft opening as the end, removing nothing', () => {
    const { f1, f2, f3, f1Marker } = seedShaftCable()
    expect(store().setCableShaftLeg(f2, 'nope', { floorId: f1, points: [], hubId: 'h1' })).toBe(false)
    expect(store().setCableShaftLeg(f2, 'cable-1', { floorId: f3, points: [], hubId: 'h1' })).toBe(false) // F3 has no opening
    expect(store().setCableShaftLeg(f2, 'cable-1', { floorId: f1, points: [], hubId: f1Marker.id })).toBe(false)
    expect(store().setCableShaftLeg(f2, 'cable-1', { floorId: f1, points: [], hubId: 'gone' })).toBe(false)
    expect(store().setCableShaftLeg(f2, 'cable-1', null)).toBe(false) // nothing to remove
    expect(steps()).toBe(0)
    expect(cableOn(f2)).not.toHaveProperty('beyondShaft')
  })

  it.each<[string, (ids: ReturnType<typeof seedShaftCable>) => void]>([
    ['its end hub is deleted', () => store().deleteHub('h1')],
    ['the exit floor\'s opening is deleted', ({ f1Marker }) => store().deleteHub(f1Marker.id)],
    ['the exit floor\'s plan image is replaced', () => store().setImage(IMAGE_C)],
    ['the exit floor is deleted', ({ f1 }) => store().deleteFloor(f1)],
  ])('the route is cleared in the SAME undo step when %s - the cable stays, not routed', (_reason, act) => {
    const ids = seedShaftCable()
    store().setCableShaftLeg(ids.f2, 'cable-1', { floorId: ids.f1, points: [], hubId: 'h1' })
    store().setActiveFloor(ids.f1) // deletes act on the active floor
    history().clear()

    act(ids)
    expect(cableOn(ids.f2)).toMatchObject({ id: 'cable-1' })
    expect(cableOn(ids.f2)).not.toHaveProperty('beyondShaft')
    expect(steps()).toBe(1)
    undoProject()
    expect(cableOn(ids.f2).beyondShaft).toEqual({ floorId: ids.f1, points: [], hubId: 'h1' })
  })

  it('a route ending on a device is cleared when that device is deleted on the exit floor, same undo step', () => {
    const { f1, f2 } = seedShaftCable()
    store().setCableShaftLeg(f2, 'cable-1', { floorId: f1, points: [], endDevice: { kind: 'camera', id: 'cam-end' } })
    store().setActiveFloor(f1)
    history().clear()
    store().deleteCamera('cam-end')
    expect(cableOn(f2)).not.toHaveProperty('beyondShaft')
    expect(steps()).toBe(1)
  })

  it('deleting the opening the cable ENTERS still deletes the cable itself', () => {
    const { f1, f2, f2Marker } = seedShaftCable()
    store().setCableShaftLeg(f2, 'cable-1', { floorId: f1, points: [], hubId: 'h1' })
    store().setActiveFloor(f2)
    store().deleteHub(f2Marker.id)
    expect(store().floors.find((f) => f.id === f2)!.cables).toEqual([])
  })

  it('a shaft opening can no longer carry a shared route: setHubTrunk refuses it', () => {
    const { f1, f1Marker } = seedShaftCable()
    expect(store().setHubTrunk({ floorId: f1, hubId: f1Marker.id }, { hubId: 'h1', points: [] })).toBe(false)
    expect(steps()).toBe(0)
  })
})

describe('a cable that ends on a device', () => {
  it('is added without a hub, and deleting EITHER device removes it in the same undo step', () => {
    store().setImage(IMAGE_A)
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCamera({ id: 'cam-2', modelId: 'm', x: 9, y: 9, rotationDeg: 0, rangeM: 5 })
    const typeId = store().cableTypes[0].id
    store().addCable({ id: 'k', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-2' }, typeId, points: [] })
    expect(getActiveFloor(store()).cables).toHaveLength(1)

    history().clear()
    store().deleteCamera('cam-2') // the END device
    expect(getActiveFloor(store()).cables).toEqual([])
    expect(steps()).toBe(1)
    undoProject()
    expect(getActiveFloor(store()).cables).toHaveLength(1)
  })

  it('addCable refuses a cable with no end, with both a hub and a device end, or ending on its own start', () => {
    store().setImage(IMAGE_A)
    store().addHub({ id: 'h1', x: 5, y: 5, mountHeightM: 1.5 })
    const typeId = store().cableTypes[0].id
    store().addCable({ id: 'none', device: { kind: 'camera', id: 'cam-1' }, typeId, points: [] })
    store().addCable({ id: 'both', device: { kind: 'camera', id: 'cam-1' }, hubId: 'h1', endDevice: { kind: 'camera', id: 'cam-2' }, typeId, points: [] })
    store().addCable({ id: 'itself', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-1' }, typeId, points: [] })
    expect(getActiveFloor(store()).cables).toEqual([])
  })
})
