import { beforeEach, describe, expect, it } from 'vitest'
import type { Hub } from '../domain/cable/cable-layout-types'
import { MAX_FLOORS } from '../domain/floor/floor-types'
import { buildFloor, buildProjectWithFloors } from '../domain/project-file/project-file-test-fixtures'
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

  it('undo of a floor delete switches back to the restored floor (phase 3 decision)', () => {
    store().addFloor('Floor B')
    const floorAId = store().floors[0].id
    const floorBId = store().activeFloorId
    store().setActiveFloor(floorAId) // move away from B before deleting it, so the switch is observable
    history().clear()

    store().deleteFloor(floorBId)
    expect(store().activeFloorId).toBe(floorAId) // deleteFloor only reassigns when the DELETED floor was active

    undoProject()
    expect(store().floors.some((f) => f.id === floorBId)).toBe(true)
    expect(store().activeFloorId).toBe(floorBId)
  })

  // H2 fix: dropped the module-level "remember where I came from" heuristic entirely. Three
  // deterministic rules instead (see `project-store.ts`'s `autoSwitchAndClamp`): (i) one floor's
  // content changed, (ii) undoING a delete restores a floor - switch to it, (iii) the floor the
  // user is ACTUALLY on vanished (either direction) - go to its nearest neighbour by index.

  it('redo of addFloor does NOT auto-switch (growth during a REDO is not rule ii - nothing was just restored)', () => {
    store().addFloor('Floor B') // active = B
    const floorAId = store().floors[0].id
    store().setActiveFloor(floorAId)
    undoProject() // rule iii: B (active) vanished -> switched to A
    expect(store().floors).toHaveLength(1)
    expect(store().activeFloorId).toBe(floorAId)

    redoProject() // B reappears, but this is a redo of an ADD, not an undo of a DELETE
    expect(store().floors).toHaveLength(2)
    expect(store().activeFloorId).toBe(floorAId) // still A - redo did not pull the view away
  })

  it('undo of addFloor returns to the floor that was active right before the add (rule iii)', () => {
    const floorAId = store().activeFloorId
    store().addFloor('Floor B') // active = B now
    expect(store().activeFloorId).not.toBe(floorAId)

    undoProject() // B (active) vanishes -> its nearest neighbour (the only one left) is A
    expect(store().floors).toHaveLength(1)
    expect(store().activeFloorId).toBe(floorAId)
  })

  it('H2 bug (a): add, undo, redo, undo - the final undo leaves exactly one floor, still active (no stale "previous active" memory to misfire)', () => {
    const floorAId = store().activeFloorId
    store().addFloor('Floor B')
    undoProject()
    expect(store().activeFloorId).toBe(floorAId)

    redoProject() // does not auto-switch (see the test above)
    expect(store().activeFloorId).toBe(floorAId)

    undoProject() // the (inactive) floor B vanishes again - A (active) is untouched either way
    expect(store().floors).toHaveLength(1)
    expect(store().activeFloorId).toBe(floorAId)
  })

  it('H2 bug (b): add, then click to a DIFFERENT existing floor, then undo - stays on the floor the user is looking at', () => {
    store().addFloor('Floor B') // floors = [A, B], active = B
    store().addFloor('Floor C') // floors = [A, B, C], active = C
    const [floorAId, floorBId] = store().floors.map((f) => f.id)

    store().setActiveFloor(floorAId) // the user deliberately looks at A, not the floor they just added
    expect(store().activeFloorId).toBe(floorAId)

    undoProject() // undoes addFloor('Floor C'): C vanishes, but A (active) did not - untouched
    expect(store().floors.map((f) => f.id)).toEqual([floorAId, floorBId])
    expect(store().activeFloorId).toBe(floorAId) // NOT pulled onto B by any remembered "previous active"
  })

  it('neighbour rule: deleteFloor of the active MIDDLE floor lands on the floor that slides into its slot, not floors[0]', () => {
    store().addFloor('Floor B')
    store().addFloor('Floor C') // floors = [A, B, C], active = C
    const [floorAId, floorBId, floorCId] = store().floors.map((f) => f.id)
    store().setActiveFloor(floorBId) // active = B, the middle floor

    store().deleteFloor(floorBId)
    expect(store().floors.map((f) => f.id)).toEqual([floorAId, floorCId])
    expect(store().activeFloorId).toBe(floorCId) // slid into B's slot - not A (floors[0])
  })

  it('neighbour rule: deleteFloor of the active LAST floor lands on the new last floor, not floors[0]', () => {
    store().addFloor('Floor B')
    store().addFloor('Floor C') // floors = [A, B, C], active = C
    const [floorAId, floorBId, floorCId] = store().floors.map((f) => f.id)
    expect(store().activeFloorId).toBe(floorCId)

    store().deleteFloor(floorCId)
    expect(store().floors.map((f) => f.id)).toEqual([floorAId, floorBId])
    expect(store().activeFloorId).toBe(floorBId) // new last floor, not A (floors[0])
  })

  it('neighbour rule via undo/redo: redoing the delete of a MIDDLE floor (rule iii) lands on its neighbour, not floors[0]', () => {
    store().addFloor('Floor B')
    store().addFloor('Floor C') // floors = [A, B, C], active = C
    const [floorAId, floorBId, floorCId] = store().floors.map((f) => f.id)
    store().setActiveFloor(floorBId) // active = B, the middle floor
    history().clear()

    store().deleteFloor(floorBId) // floors = [A, C], active = C (deleteFloor's own neighbour rule)
    undoProject() // rule ii: B reappears (back in its original middle slot) - switch to it
    expect(store().floors.map((f) => f.id)).toEqual([floorAId, floorBId, floorCId])
    expect(store().activeFloorId).toBe(floorBId)

    redoProject() // rule iii: B (active, at middle index 1) vanishes again -> nearest neighbour
    expect(store().floors.map((f) => f.id)).toEqual([floorAId, floorCId])
    expect(store().activeFloorId).toBe(floorCId) // not A (floors[0])
  })
})

// M2 fix: a plain `activeFloorId` comparison misses a project load that lands on the SAME id
// as before (two legacy, pre-v7 files BOTH wrap their one floor as `LEGACY_FLOOR_ID`) - `loadSeq`
// changes on every `replaceProject`/`resetProject` call regardless, independently of whether the
// id happens to repeat, and also drives `editor-ui-store`'s `projectLoadEpoch` (the stage's
// remount key in `app.tsx`).
describe('project load (M2): resets view state and bumps the remount epoch even when activeFloorId repeats', () => {
  it('two loads that both land on the SAME floor id still reset selection/tool and bump the epoch', () => {
    const projectA = buildProjectWithFloors([buildFloor({ id: 'shared-id', name: 'From file A' })])
    const projectB = buildProjectWithFloors([buildFloor({ id: 'shared-id', name: 'From file B' })])

    store().replaceProject(projectA)
    expect(store().activeFloorId).toBe('shared-id')
    const epochAfterFirstLoad = useEditorUiStore.getState().projectLoadEpoch

    useEditorUiStore.getState().setSelectedCameraId('some-camera')
    useEditorUiStore.getState().setToolMode('wall')

    store().replaceProject(projectB) // SAME activeFloorId as before - a plain id check would miss this load
    expect(store().activeFloorId).toBe('shared-id') // confirms the id really did not change
    expect(store().floors[0].name).toBe('From file B') // but the floor's own content did
    expect(useEditorUiStore.getState().selectedCameraId).toBeNull()
    expect(useEditorUiStore.getState().toolMode).toBe('select')
    expect(useEditorUiStore.getState().projectLoadEpoch).toBe(epochAfterFirstLoad + 1)
  })

  it('resetProject also bumps the epoch (treated the same as a project load)', () => {
    const epochBefore = useEditorUiStore.getState().projectLoadEpoch
    store().resetProject()
    expect(useEditorUiStore.getState().projectLoadEpoch).toBe(epochBefore + 1)
  })

  it('a plain floor switch (setActiveFloor) does NOT bump the epoch - only a project load does', () => {
    store().addFloor('Floor B')
    const epochBefore = useEditorUiStore.getState().projectLoadEpoch
    store().setActiveFloor(store().floors[0].id)
    expect(useEditorUiStore.getState().projectLoadEpoch).toBe(epochBefore)
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
