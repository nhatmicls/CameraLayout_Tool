import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'
import { buildFloor, buildProjectWithFloors } from '../domain/project-file/project-file-test-fixtures'
import type { PlacedCamera, Wall } from '../domain/project-file/project-types'
import type { PlacedSectorSensor } from '../domain/sensor/sensor-types'

/** The active floor's live fields - the test twin of `getActiveFloor`, read fresh every call (never cached) so it always reflects the latest `set()`. */
const activeFloor = () => getActiveFloor(useProjectStore.getState())

function makeCamera(overrides: Partial<PlacedCamera> = {}): PlacedCamera {
  return { id: 'cam-1', modelId: 'hik-dome-2.8', x: 10, y: 10, rotationDeg: 0, rangeM: 10, ...overrides }
}

function makeWall(overrides: Partial<Wall> = {}): Wall {
  return { id: 'wall-1', kind: 'opaque', x1: 0, y1: 0, x2: 100, y2: 0, ...overrides }
}

function makeSensor(overrides: Partial<PlacedSectorSensor> = {}): PlacedSectorSensor {
  return { id: 'sensor-1', modelId: 'pir-1', shape: 'sector', x: 10, y: 10, rotationDeg: 0, rangeM: 10, ...overrides }
}

const OTHER_IMAGE = { dataUrl: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'other.png' }

describe('useProjectStore walls', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it('adds, updates and deletes a wall, each undoable and redoable', () => {
    const { addWall, updateWall, deleteWall } = useProjectStore.getState()
    const { undo, redo } = useProjectStore.temporal.getState()

    addWall(makeWall())
    expect(activeFloor().walls).toEqual([makeWall()])
    undo()
    expect(activeFloor().walls).toEqual([])
    redo()
    expect(activeFloor().walls).toEqual([makeWall()])

    updateWall('wall-1', { kind: 'glass' })
    expect(activeFloor().walls[0].kind).toBe('glass')
    undo()
    expect(activeFloor().walls[0].kind).toBe('opaque')
    redo()
    expect(activeFloor().walls[0].kind).toBe('glass')

    deleteWall('wall-1')
    expect(activeFloor().walls).toEqual([])
    undo()
    expect(activeFloor().walls).toHaveLength(1)
    redo()
    expect(activeFloor().walls).toEqual([])
  })

  it('undoes a chain of walls one segment at a time', () => {
    useProjectStore.getState().addWall(makeWall({ id: 'a' }))
    useProjectStore.getState().addWall(makeWall({ id: 'b', x1: 100, x2: 100, y2: 100 }))
    useProjectStore.temporal.getState().undo()
    expect(activeFloor().walls.map((w) => w.id)).toEqual(['a'])
  })

  it("keeps other walls' object identity on updateWall and ignores an unknown id", () => {
    useProjectStore.getState().addWall(makeWall({ id: 'a' }))
    useProjectStore.getState().addWall(makeWall({ id: 'b' }))
    const [a, b] = activeFloor().walls

    useProjectStore.getState().updateWall('b', { kind: 'glass' })
    expect(activeFloor().walls[0]).toBe(a)
    expect(activeFloor().walls[1]).not.toBe(b)

    useProjectStore.getState().updateWall('missing', { kind: 'glass' })
    expect(activeFloor().walls[0]).toBe(a)
  })

  it('keeps the redo stack and adds no undo step when the wall id is unknown (stale selection after undo)', () => {
    useProjectStore.getState().addWall(makeWall())
    useProjectStore.temporal.getState().undo()
    const wallsBefore = activeFloor().walls

    useProjectStore.getState().deleteWall('wall-1')
    useProjectStore.getState().updateWall('wall-1', { kind: 'glass' })

    expect(activeFloor().walls).toBe(wallsBefore)
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useProjectStore.temporal.getState().futureStates).toHaveLength(1)
    useProjectStore.temporal.getState().redo()
    expect(activeFloor().walls).toEqual([makeWall()])
  })

  // Rewritten for the floors restructure (drift addendum): `setImage` is now ONE ordinary
  // undo step on the active floor and NEVER clears history - only `resetProject`/
  // `replaceProject` do. See the "setImage" describe block below for the full behaviour.
  it('clears walls on setImage (one undo step, history kept) and on resetProject (history cleared)', () => {
    useProjectStore.getState().addWall(makeWall()) // step 1
    useProjectStore.getState().setImage(OTHER_IMAGE) // step 2 - exactly one more, never clears
    expect(activeFloor().walls).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(2)

    useProjectStore.getState().addWall(makeWall())
    useProjectStore.getState().resetProject()
    expect(activeFloor().walls).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('moves a shared node as one undo step and ignores a move that would collapse a wall', () => {
    useProjectStore.getState().addWall(makeWall({ id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 }))
    useProjectStore.getState().addWall(makeWall({ id: 'b', x1: 100, y1: 0, x2: 100, y2: 100 }))
    const stepsBefore = useProjectStore.temporal.getState().pastStates.length

    useProjectStore.getState().moveWallNode({ x: 100, y: 0 }, { x: 150, y: 20 })
    expect(activeFloor().walls).toMatchObject([
      { id: 'a', x2: 150, y2: 20 },
      { id: 'b', x1: 150, y1: 20, x2: 100, y2: 100 },
    ])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore + 1)

    const walls = activeFloor().walls
    useProjectStore.getState().moveWallNode({ x: 150, y: 20 }, { x: 0, y: 0 }) // onto wall a's other end
    expect(activeFloor().walls).toBe(walls)
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore + 1)

    useProjectStore.temporal.getState().undo()
    expect(activeFloor().walls).toMatchObject([{ x2: 100, y2: 0 }, { x1: 100, y1: 0 }])
  })

  it('takes its walls from replaceProject', () => {
    useProjectStore.getState().addWall(makeWall({ id: 'old' }))
    useProjectStore.getState().replaceProject(buildProjectWithFloors([buildFloor({ image: OTHER_IMAGE, walls: [makeWall({ id: 'new' })] })]))
    expect(activeFloor().walls.map((w) => w.id)).toEqual(['new'])
  })
})

describe('useProjectStore sensors', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it('adds, updates and deletes a sensor, each undoable and redoable', () => {
    const { addSensor, updateSensor, deleteSensor } = useProjectStore.getState()
    const { undo, redo } = useProjectStore.temporal.getState()

    addSensor(makeSensor())
    expect(activeFloor().sensors).toEqual([makeSensor()])
    undo()
    expect(activeFloor().sensors).toEqual([])
    redo()
    expect(activeFloor().sensors).toEqual([makeSensor()])

    updateSensor('sensor-1', { rangeM: 20 })
    expect(activeFloor().sensors[0]).toMatchObject({ rangeM: 20 })
    undo()
    expect(activeFloor().sensors[0]).toMatchObject({ rangeM: 10 })
    redo()
    expect(activeFloor().sensors[0]).toMatchObject({ rangeM: 20 })

    deleteSensor('sensor-1')
    expect(activeFloor().sensors).toEqual([])
    undo()
    expect(activeFloor().sensors).toHaveLength(1)
    redo()
    expect(activeFloor().sensors).toEqual([])
  })

  it('ignores an unknown id on updateSensor/deleteSensor and adds no history step', () => {
    useProjectStore.getState().addSensor(makeSensor())
    const stepsBefore = useProjectStore.temporal.getState().pastStates.length
    const sensorsBefore = activeFloor().sensors

    useProjectStore.getState().updateSensor('missing', { rangeM: 99 })
    useProjectStore.getState().deleteSensor('missing')

    expect(activeFloor().sensors).toBe(sensorsBefore)
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore)
  })

  it('adds no history step when the patch is a no-op (nothing in it applies)', () => {
    useProjectStore.getState().addSensor(makeSensor())
    const stepsBefore = useProjectStore.temporal.getState().pastStates.length

    useProjectStore.getState().updateSensor('sensor-1', {})

    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore)
  })

  // Rewritten for the floors restructure, same as the wall test above.
  it('clears sensors on setImage (one undo step, history kept) and on resetProject (history cleared)', () => {
    useProjectStore.getState().addSensor(makeSensor()) // step 1
    useProjectStore.getState().setImage(OTHER_IMAGE) // step 2 - exactly one more, never clears
    expect(activeFloor().sensors).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(2)

    useProjectStore.getState().addSensor(makeSensor())
    useProjectStore.getState().resetProject()
    expect(activeFloor().sensors).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('takes its sensors from replaceProject', () => {
    useProjectStore.getState().addSensor(makeSensor({ id: 'old' }))
    useProjectStore.getState().replaceProject(buildProjectWithFloors([buildFloor({ image: OTHER_IMAGE, sensors: [makeSensor({ id: 'new' })] })]))
    expect(activeFloor().sensors.map((s) => s.id)).toEqual(['new'])
  })
})

describe('useProjectStore undo/redo (zundo)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
    useProjectStore.temporal.getState().clear()
  })

  it('undoes an add then redoes it', () => {
    useProjectStore.getState().addCamera(makeCamera())
    expect(activeFloor().cameras).toHaveLength(1)

    useProjectStore.temporal.getState().undo()
    expect(activeFloor().cameras).toHaveLength(0)

    useProjectStore.temporal.getState().redo()
    expect(activeFloor().cameras).toHaveLength(1)
  })

  it('undoes a move (updateCamera) back to the prior position', () => {
    useProjectStore.getState().addCamera(makeCamera({ x: 10, y: 10 }))
    useProjectStore.getState().updateCamera('cam-1', { x: 50, y: 60 })
    expect(activeFloor().cameras[0]).toMatchObject({ x: 50, y: 60 })

    useProjectStore.temporal.getState().undo()
    expect(activeFloor().cameras[0]).toMatchObject({ x: 10, y: 10 })

    useProjectStore.temporal.getState().redo()
    expect(activeFloor().cameras[0]).toMatchObject({ x: 50, y: 60 })
  })

  it('sets, clears and undoes mounting height + tilt', () => {
    useProjectStore.getState().addCamera(makeCamera())
    useProjectStore.getState().updateCamera('cam-1', { mountHeightM: 3, tiltDeg: 20 })
    expect(activeFloor().cameras[0]).toMatchObject({ mountHeightM: 3, tiltDeg: 20 })

    useProjectStore.getState().updateCamera('cam-1', { mountHeightM: undefined, tiltDeg: undefined })
    expect(activeFloor().cameras[0].mountHeightM).toBeUndefined()
    expect(activeFloor().cameras[0].tiltDeg).toBeUndefined()

    useProjectStore.temporal.getState().undo()
    expect(activeFloor().cameras[0]).toMatchObject({ mountHeightM: 3, tiltDeg: 20 })
  })

  it('clears history on replaceProject so undo cannot reach past a different plan', () => {
    useProjectStore.getState().addCamera(makeCamera())
    expect(useProjectStore.temporal.getState().pastStates.length).toBeGreaterThan(0)

    useProjectStore.getState().replaceProject(buildProjectWithFloors([buildFloor({ image: OTHER_IMAGE })]))

    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useProjectStore.temporal.getState().futureStates).toHaveLength(0)
  })
})
