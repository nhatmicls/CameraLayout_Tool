import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_SHAFTS } from '../domain/cable/cable-layout-types'
import { computeProjectCableEstimate } from '../domain/cable/project-cable-layout-estimate'
import type { PlanImage } from '../domain/project-file/project-types'
import { useEditorUiStore } from './editor-ui-store'
import { redoProject, undoProject, useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'

const store = () => useProjectStore.getState()
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length
/** A fresh `computeProjectCableEstimate` read of the LIVE store, bypassing its single-slot memo's reference-equality cache (irrelevant here - each call sees a genuinely new `floors` after every store write anyway). */
const currentProjectEstimate = () => {
  const { floors, shafts, cableTypes, cableSettings, fireAlarmSettings } = store()
  return computeProjectCableEstimate({ floors, shafts, cableTypes, cableSettings, fireAlarmSettings })
}

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

  it('deleting an exit marker clears cable choices naming it elsewhere, same undo step', () => {
    const [f1, f2] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 1, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const f1Marker = store().floors.find((f) => f.id === f1)!.hubs.find((h) => h.kind === 'shaft')!
    const f2Marker = store().floors.find((f) => f.id === f2)!.hubs.find((h) => h.kind === 'shaft')!
    // Give F1's marker a trunk (needs another hub on F1) - makes it the shaft's only exit.
    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: f1Marker.id }, { hubId: 'h1', points: [] })
    // A cable on F2's marker, explicitly choosing F1's exit (only one exists, but set explicitly for this test).
    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: f2Marker.id, typeId: store().cableTypes[0].id, points: [] })
    store().setCableExitFloorId('cable-1', f1)
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBe(f1)

    history().clear()
    store().setActiveFloor(f1) // cabling actions (deleteHub included) always act on the ACTIVE floor
    store().deleteHub(f1Marker.id) // the exit marker itself
    const f2Cable = store().floors.find((f) => f.id === f2)!.cables[0]
    expect(f2Cable.exitFloorId).toBeUndefined() // cleared - the exit is gone
    expect(steps()).toBe(1)
  })
})

describe('setHubTrunk - shaft exit stamping / clearing', () => {
  it('gaining a SECOND exit stamps every choiceless cable with the floor of the one it was implicitly using', () => {
    const [f1, f2, f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const markerByFloor = new Map(store().floors.map((f) => [f.id, f.hubs.find((h) => h.kind === 'shaft')!]))

    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: markerByFloor.get(f1)!.id }, { hubId: 'h1', points: [] }) // F1 becomes the first (implicit) exit

    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-2', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({
      id: 'cable-2',
      device: { kind: 'camera', id: 'cam-2' },
      hubId: markerByFloor.get(f2)!.id,
      typeId: store().cableTypes[0].id,
      points: [],
    })
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBeUndefined() // implicit so far, no choice needed

    store().setActiveFloor(f3)
    store().addHub({ id: 'h2', x: 900, y: 900, mountHeightM: 1.5 })
    history().clear()
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, { hubId: 'h2', points: [] }) // F3 becomes the SECOND exit

    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBe(f1) // stamped to the pre-existing (F1) exit
    expect(steps()).toBe(1) // stamping happened in the SAME set() as the trunk write
  })

  it('removing the only-remaining exit clears choices back to the typed fallback (no restamping)', () => {
    const [f1] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 0, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const marker = getActiveFloor(store()).hubs.find((h) => h.kind === 'shaft')!
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: marker.id }, { hubId: 'h1', points: [] })
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: marker.id, typeId: store().cableTypes[0].id, points: [] })
    // The cable is given an EXPLICIT choice first - without this, `exitFloorId` was already
    // `undefined` before the removal too, making the final assertion vacuously true.
    store().setCableExitFloorId('cable-1', f1)
    expect(store().floors[0].cables[0].exitFloorId).toBe(f1)

    store().setHubTrunk({ floorId: f1, hubId: marker.id }, null) // remove the shaft's only exit
    expect(store().floors[0].hubs.find((h) => h.kind === 'shaft')!.trunk).toBeUndefined()
    expect(store().floors[0].cables[0].exitFloorId).toBeUndefined() // really cleared, not vacuous
  })

  it('lengths are IDENTICAL immediately before and after 1 -> 2 stamping (behaviour preserved, not changed)', () => {
    const [f1, f2, f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const markerByFloor = new Map(store().floors.map((f) => [f.id, f.hubs.find((h) => h.kind === 'shaft')!]))

    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setScale({ planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 })
    store().setHubTrunk({ floorId: f1, hubId: markerByFloor.get(f1)!.id }, { hubId: 'h1', points: [] })

    store().setActiveFloor(f2)
    store().setScale({ planPxPerMeter: 10, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 10 })
    store().addCamera({ id: 'cam-2', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({
      id: 'cable-2',
      device: { kind: 'camera', id: 'cam-2' },
      hubId: markerByFloor.get(f2)!.id,
      typeId: store().cableTypes[0].id,
      points: [],
    })
    const lengthBefore = currentProjectEstimate().byFloorId.get(f2)!.byCableId.get('cable-2')!.run.nominal

    store().setActiveFloor(f3)
    store().addHub({ id: 'h2', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, { hubId: 'h2', points: [] }) // the SECOND exit - stamps cable-2 to F1

    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBe(f1)
    const lengthAfter = currentProjectEstimate().byFloorId.get(f2)!.byCableId.get('cable-2')!.run.nominal
    expect(lengthAfter).toBeCloseTo(lengthBefore, 6)
  })

  it('undo of the 1 -> 2 stamping restores the choiceless (implicit) state, in the SAME step as the trunk removal', () => {
    const [f1, f2, f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const markerByFloor = new Map(store().floors.map((f) => [f.id, f.hubs.find((h) => h.kind === 'shaft')!]))

    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: markerByFloor.get(f1)!.id }, { hubId: 'h1', points: [] })
    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-2', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({
      id: 'cable-2',
      device: { kind: 'camera', id: 'cam-2' },
      hubId: markerByFloor.get(f2)!.id,
      typeId: store().cableTypes[0].id,
      points: [],
    })
    store().setActiveFloor(f3)
    store().addHub({ id: 'h2', x: 900, y: 900, mountHeightM: 1.5 })
    history().clear()
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, { hubId: 'h2', points: [] }) // stamps cable-2 to F1
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBe(f1)

    undoProject()
    expect(store().floors.find((f) => f.id === f3)!.hubs.find((h) => h.kind === 'shaft')!.trunk).toBeUndefined()
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBeUndefined() // the stamp undoes WITH the trunk, one step
  })

  it('2 -> 1 -> 2: removing one exit then drawing a new second one re-stamps to whichever is sole at the time', () => {
    const [f1, f2, f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const markerByFloor = new Map(store().floors.map((f) => [f.id, f.hubs.find((h) => h.kind === 'shaft')!]))

    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: markerByFloor.get(f1)!.id }, { hubId: 'h1', points: [] })
    store().setActiveFloor(f3)
    store().addHub({ id: 'h2', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, { hubId: 'h2', points: [] }) // 2 exits: F1, F3

    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-2', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({
      id: 'cable-2',
      device: { kind: 'camera', id: 'cam-2' },
      hubId: markerByFloor.get(f2)!.id,
      typeId: store().cableTypes[0].id,
      points: [],
    }) // no choice - "not chosen" with 2 exits

    // Remove F3's exit: back to 1 exit (F1) - implicit again, no stamp needed (cable-2 still has none).
    store().setActiveFloor(f3)
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, null)
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBeUndefined()

    // Draw a NEW second exit on a 4th opening... reuse F3 again: this is the shaft's SECOND exit
    // again (F1 is the sole exit right now) - cable-2, still choiceless, gets stamped to F1.
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, { hubId: 'h2', points: [] })
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBe(f1)
  })
})

describe('assignShaftCableExits', () => {
  it('bulk-assigns every choiceless cable on one floor, one undo step; refuses a non-exit floor', () => {
    const [f1, f2, f3] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 2, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const markerByFloor = new Map(store().floors.map((f) => [f.id, f.hubs.find((h) => h.kind === 'shaft')!]))

    store().setActiveFloor(f1)
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: markerByFloor.get(f1)!.id }, { hubId: 'h1', points: [] })
    store().setActiveFloor(f3)
    store().addHub({ id: 'h2', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f3, hubId: markerByFloor.get(f3)!.id }, { hubId: 'h2', points: [] })

    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-a', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCamera({ id: 'cam-b', modelId: 'm', x: 2, y: 2, rotationDeg: 0, rangeM: 5 })
    const typeId = store().cableTypes[0].id
    store().addCable({ id: 'cable-a', device: { kind: 'camera', id: 'cam-a' }, hubId: markerByFloor.get(f2)!.id, typeId, points: [] })
    store().addCable({ id: 'cable-b', device: { kind: 'camera', id: 'cam-b' }, hubId: markerByFloor.get(f2)!.id, typeId, points: [] })

    // Refuses a floor that is not one of the shaft's exits.
    history().clear()
    store().assignShaftCableExits(f2, markerByFloor.get(f2)!.id, f2)
    expect(steps()).toBe(0)
    expect(store().floors.find((f) => f.id === f2)!.cables.every((c) => c.exitFloorId === undefined)).toBe(true)

    store().assignShaftCableExits(f2, markerByFloor.get(f2)!.id, f3)
    expect(steps()).toBe(1)
    expect(store().floors.find((f) => f.id === f2)!.cables.every((c) => c.exitFloorId === f3)).toBe(true)
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

describe('setCableExitFloorId (M7 validation)', () => {
  it('no-ops on an unknown cable id', () => {
    seedThreeFloorsWithImages()
    const floorsBefore = store().floors
    store().setCableExitFloorId('does-not-exist', 'whatever')
    expect(store().floors).toBe(floorsBefore)
  })

  it('no-ops when the cable does not end on a shaft marker at all', () => {
    const [f1] = seedThreeFloorsWithImages()
    store().addHub({ id: 'plain-1', x: 1, y: 1, mountHeightM: 1.5 })
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'plain-1', typeId: store().cableTypes[0].id, points: [] })
    history().clear()
    store().setCableExitFloorId('cable-1', f1)
    expect(steps()).toBe(0)
    expect(store().floors[0].cables[0].exitFloorId).toBeUndefined()
  })

  it('no-ops when exitFloorId does not name a current exit of the cable\'s shaft', () => {
    const [f1, f2] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 1, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const markerF2 = store().floors.find((f) => f.id === f2)!.hubs.find((h) => h.kind === 'shaft')!
    store().setActiveFloor(f2)
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: markerF2.id, typeId: store().cableTypes[0].id, points: [] })
    history().clear()
    // F1 is a real floor and a real marker of this shaft, but NOT an exit (no trunk drawn yet).
    store().setCableExitFloorId('cable-1', f1)
    expect(steps()).toBe(0)
    expect(store().floors.find((f) => f.id === f2)!.cables[0].exitFloorId).toBeUndefined()
  })

  it('clears with null, only on the active floor\'s own cable', () => {
    const [f1] = seedThreeFloorsWithImages()
    const result = store().createShaft('Main shaft', 0, 0, { x: 10, y: 10 })
    if (!result.ok) throw new Error('unreachable')
    const marker = getActiveFloor(store()).hubs.find((h) => h.kind === 'shaft')!
    store().addHub({ id: 'h1', x: 900, y: 900, mountHeightM: 1.5 })
    store().setHubTrunk({ floorId: f1, hubId: marker.id }, { hubId: 'h1', points: [] })
    store().addCamera({ id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5 })
    store().addCable({ id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: marker.id, typeId: store().cableTypes[0].id, points: [] })
    store().setCableExitFloorId('cable-1', f1)
    expect(store().floors[0].cables[0].exitFloorId).toBe(f1)

    store().setCableExitFloorId('cable-1', null)
    expect(store().floors[0].cables[0].exitFloorId).toBeUndefined()
  })
})
