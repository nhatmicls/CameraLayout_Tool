import { beforeEach, describe, expect, it } from 'vitest'
import type { Hub } from '../domain/cable/cable-layout-types'
import { MAX_FLOORS } from '../domain/floor/floor-types'
import type { PlacedCamera, PlanImage } from '../domain/project-file/project-types'
import { useEditorUiStore } from './editor-ui-store'
import { redoProject, undoProject, useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'

const store = () => useProjectStore.getState()
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length
const activeFloor = () => getActiveFloor(store())

const IMAGE_A: PlanImage = { dataUrl: 'data:image/png;base64,AAAA', widthPx: 100, heightPx: 80, fileName: 'a.png' }
const IMAGE_B: PlanImage = { dataUrl: 'data:image/png;base64,BBBB', widthPx: 50, heightPx: 40, fileName: 'b.png' }

function makeCamera(overrides: Partial<PlacedCamera> = {}): PlacedCamera {
  return { id: 'cam-1', modelId: 'm', x: 1, y: 1, rotationDeg: 0, rangeM: 5, ...overrides }
}

function makeHub(overrides: Partial<Hub> = {}): Hub {
  return { id: 'hub-1', x: 10, y: 10, mountHeightM: 1.5, ...overrides }
}

beforeEach(() => {
  store().resetProject()
  history().clear()
  useEditorUiStore.getState().clearSelection()
  useEditorUiStore.getState().setToolMode('select')
  useEditorUiStore.getState().setHasUnsavedChanges(false)
})

// --- Phase 2 step 1: prove zundo `equality` and snapshot reference-sharing on the REAL store,
// before anything else in this phase is built on top of those assumptions. ---
describe('zundo equality + snapshot reference sharing', () => {
  it('a set() that only changes activeFloorId (switching floors) adds no pastStates entry', () => {
    store().addFloor('Floor B') // one real step: floors changes, so this itself IS tracked
    const stepsAfterAdd = steps()
    const floorAId = store().floors[0].id

    store().setActiveFloor(floorAId) // only `activeFloorId` changes - must add nothing
    expect(steps()).toBe(stepsAfterAdd)
    store().setActiveFloor(store().floors[1].id)
    expect(steps()).toBe(stepsAfterAdd)
  })

  it("a past snapshot's untouched floor is the SAME object still live now (partialize does not clone)", () => {
    store().addFloor('Floor B') // step 1
    const floorBId = store().activeFloorId
    store().setActiveFloor(store().floors[0].id) // -> A, no step
    store().addCamera(makeCamera()) // step 2, touches floor A only

    const lastSnapshot = history().pastStates[history().pastStates.length - 1]
    const liveFloorB = store().floors.find((f) => f.id === floorBId)
    expect(lastSnapshot.floors?.find((f) => f.id === floorBId)).toBe(liveFloorB)
  })

  it("a past snapshot's image data URL is the same string the live floor held at that point", () => {
    store().setImage(IMAGE_A)
    store().setImage(IMAGE_B)
    // pastStates holds the state as it was BEFORE each step, so the entry pushed right
    // before the IMAGE_B replace still has IMAGE_A's data URL.
    const snapshotBeforeReplace = history().pastStates[history().pastStates.length - 1]
    expect(snapshotBeforeReplace.floors?.[0].image?.dataUrl).toBe(IMAGE_A.dataUrl)
  })
})

describe('setActiveFloor', () => {
  it('adds no history step, does not mark the project dirty, clears selection and resets the tool', () => {
    store().addFloor('Floor B')
    const floorAId = store().floors[0].id
    history().clear()
    useEditorUiStore.getState().setHasUnsavedChanges(false)
    useEditorUiStore.getState().setSelectedCameraId('cam-1')
    useEditorUiStore.getState().setToolMode('wall')

    store().setActiveFloor(floorAId)

    expect(steps()).toBe(0)
    expect(useEditorUiStore.getState().hasUnsavedChanges).toBe(false)
    expect(useEditorUiStore.getState().selectedCameraId).toBeNull()
    expect(useEditorUiStore.getState().toolMode).toBe('select')
  })

  it('is a no-op for the already-active floor or an unknown id', () => {
    const onlyFloorId = store().activeFloorId
    store().setActiveFloor(onlyFloorId)
    store().setActiveFloor('does-not-exist')
    expect(store().activeFloorId).toBe(onlyFloorId)
    expect(steps()).toBe(0)
  })
})

describe('floor list actions', () => {
  it('addFloor: one undo step, the new floor becomes active, undo/redo restore it', () => {
    const firstFloorId = store().activeFloorId
    store().addFloor('Floor B')
    expect(store().floors).toHaveLength(2)
    expect(store().activeFloorId).not.toBe(firstFloorId)
    expect(steps()).toBe(1)

    history().undo()
    expect(store().floors).toHaveLength(1)
    history().redo()
    expect(store().floors).toHaveLength(2)
  })

  it('addFloor is a no-op at MAX_FLOORS', () => {
    for (let i = 0; i < MAX_FLOORS - 1; i++) store().addFloor(`Floor ${i}`)
    expect(store().floors).toHaveLength(MAX_FLOORS)
    const stepsBefore = steps()

    store().addFloor('One too many')

    expect(store().floors).toHaveLength(MAX_FLOORS)
    expect(steps()).toBe(stepsBefore)
  })

  it('renameFloor: one step, trims the name, undoable', () => {
    const id = store().activeFloorId
    store().renameFloor(id, '  New name  ')
    expect(store().floors[0].name).toBe('New name')
    expect(steps()).toBe(1)
    history().undo()
    expect(store().floors[0].name).not.toBe('New name')
  })

  it('moveFloor: one step, reorders, undoable', () => {
    store().addFloor('Floor B')
    const [idA, idB] = store().floors.map((f) => f.id)
    store().moveFloor(idB, 0)
    expect(store().floors.map((f) => f.id)).toEqual([idB, idA])
    history().undo()
    expect(store().floors.map((f) => f.id)).toEqual([idA, idB])
  })

  it('deleteFloor: one step, undoable; no-op on the last remaining floor', () => {
    store().addFloor('Floor B')
    const [idA, idB] = store().floors.map((f) => f.id)
    const stepsBefore = steps()

    store().deleteFloor(idB)
    expect(store().floors.map((f) => f.id)).toEqual([idA])
    expect(steps()).toBe(stepsBefore + 1)

    history().undo()
    expect(store().floors.map((f) => f.id)).toEqual([idA, idB])

    // Back down to one floor (redo the delete), then deleting the last one must no-op.
    history().redo()
    expect(store().floors.map((f) => f.id)).toEqual([idA])
    const stepsAfterRedo = steps()
    store().deleteFloor(idA)
    expect(store().floors).toHaveLength(1)
    expect(steps()).toBe(stepsAfterRedo)
  })

  it('undo of a floor delete restores the SAME image string and the cameras on it', () => {
    store().addFloor('Floor B')
    store().setImage(IMAGE_B)
    store().addCamera(makeCamera({ id: 'cam-b' }))
    const floorBId = store().activeFloorId
    store().setActiveFloor(store().floors[0].id)
    history().clear()

    store().deleteFloor(floorBId)
    expect(store().floors.some((f) => f.id === floorBId)).toBe(false)

    history().undo()
    const restored = store().floors.find((f) => f.id === floorBId)
    expect(restored?.image?.dataUrl).toBe(IMAGE_B.dataUrl)
    expect(restored?.cameras.map((c) => c.id)).toEqual(['cam-b'])
  })

  it('setFloorHeight: one step; the same value is a no-op', () => {
    const id = store().activeFloorId
    store().setFloorHeight(id, 4.2)
    expect(store().floors[0].floorHeightM).toBe(4.2)
    expect(steps()).toBe(1)

    store().setFloorHeight(id, 4.2)
    expect(steps()).toBe(1) // no new step

    store().setFloorHeight('unknown', 9)
    expect(steps()).toBe(1)
  })
})

describe('undo/redo auto-switch + clamp', () => {
  it('editing floor A while viewing floor B: undo switches to A, redo stays on A', () => {
    store().addFloor('Floor B')
    const floorAId = store().floors[0].id
    const floorBId = store().activeFloorId
    store().setActiveFloor(floorAId)
    history().clear()

    store().addCamera(makeCamera({ id: 'cam-a' }))
    store().setActiveFloor(floorBId)
    expect(store().activeFloorId).toBe(floorBId)

    undoProject()
    expect(store().activeFloorId).toBe(floorAId)
    expect(getActiveFloor(store()).cameras).toHaveLength(0)

    redoProject()
    expect(store().activeFloorId).toBe(floorAId)
    expect(getActiveFloor(store()).cameras).toHaveLength(1)
  })

  it('undo that removes the active floor clamps activeFloorId to an existing floor', () => {
    store().addFloor('Floor B') // active = B now
    expect(store().floors).toHaveLength(2)

    undoProject() // undoes the add: floor B no longer exists, but activeFloorId still pointed at it
    expect(store().floors).toHaveLength(1)
    expect(store().floors.some((f) => f.id === store().activeFloorId)).toBe(true)
  })
})

describe('setImage', () => {
  it('is one undo step for the first image and for a replacement; never clears history', () => {
    store().setImage(IMAGE_A)
    expect(steps()).toBe(1)

    store().setScale({ planPxPerMeter: 20, refLine: { x1: 0, y1: 0, x2: 20, y2: 0 }, refLengthM: 1 })
    store().addCamera(makeCamera())
    const stepsBeforeReplace = steps()
    const oldImage = activeFloor().image
    const oldScale = activeFloor().scale
    const oldCameras = activeFloor().cameras

    store().setImage(IMAGE_B)
    expect(steps()).toBe(stepsBeforeReplace + 1) // one more step, history never cleared
    expect(activeFloor().image).toEqual(IMAGE_B)
    expect(activeFloor().scale).toBeNull()
    expect(activeFloor().cameras).toEqual([])

    history().undo()
    expect(activeFloor().image).toBe(oldImage) // SAME object reference restored
    expect(activeFloor().scale).toEqual(oldScale)
    expect(activeFloor().cameras).toEqual(oldCameras)
  })

  it("replacing floor A's image does not disturb floor B's earlier, still-undoable steps", () => {
    store().addFloor('Floor B') // step 1
    store().setImage(IMAGE_B) // step 2 (floor B)
    store().addCamera(makeCamera({ id: 'cam-b' })) // step 3 (floor B)
    const floorAId = store().floors[0].id
    const floorBId = store().activeFloorId
    store().setActiveFloor(floorAId) // no step

    store().setImage(IMAGE_A) // step 4 (floor A)
    expect(steps()).toBe(4)

    undoProject() // undoes step 4 (floor A's image)
    expect(getActiveFloor(store()).image).toBeNull()

    undoProject() // undoes step 3 (floor B's camera) - must still be reachable
    expect(store().activeFloorId).toBe(floorBId)
    expect(getActiveFloor(store()).cameras).toHaveLength(0)

    undoProject() // undoes step 2 (floor B's image)
    expect(getActiveFloor(store()).image).toBeNull()
  })
})

describe('cabling adapter floor isolation', () => {
  it("addCable on floor B never touches floor A's hubs/cables arrays", () => {
    store().addFloor('Floor B')
    store().addCamera(makeCamera({ id: 'cam-b' }))
    store().addHub(makeHub({ id: 'hub-b' }))
    const floorA = store().floors.find((f) => f.id !== store().activeFloorId)!
    const cablesABefore = floorA.cables
    const hubsABefore = floorA.hubs

    store().addCable({ id: 'cable-b', device: { kind: 'camera', id: 'cam-b' }, hubId: 'hub-b', typeId: 'cat6-utp', points: [] })

    const floorAAfter = store().floors.find((f) => f.id === floorA.id)!
    expect(floorAAfter).toBe(floorA) // whole floor object identity kept
    expect(floorAAfter.cables).toBe(cablesABefore)
    expect(floorAAfter.hubs).toBe(hubsABefore)
    expect(getActiveFloor(store()).cables).toHaveLength(1)
  })
})
