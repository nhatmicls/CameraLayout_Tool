import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from './project-store'
import { createEmptyCableLayout } from '../domain/cable/cable-layout-types'
import { createEmptyFireAlarmLayout, type PlacedCamera, type Wall } from '../domain/project-file/project-types'
import type { PlacedSectorSensor } from '../domain/sensor/sensor-types'

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
    expect(useProjectStore.getState().walls).toEqual([makeWall()])
    undo()
    expect(useProjectStore.getState().walls).toEqual([])
    redo()
    expect(useProjectStore.getState().walls).toEqual([makeWall()])

    updateWall('wall-1', { kind: 'glass' })
    expect(useProjectStore.getState().walls[0].kind).toBe('glass')
    undo()
    expect(useProjectStore.getState().walls[0].kind).toBe('opaque')
    redo()
    expect(useProjectStore.getState().walls[0].kind).toBe('glass')

    deleteWall('wall-1')
    expect(useProjectStore.getState().walls).toEqual([])
    undo()
    expect(useProjectStore.getState().walls).toHaveLength(1)
    redo()
    expect(useProjectStore.getState().walls).toEqual([])
  })

  it('undoes a chain of walls one segment at a time', () => {
    useProjectStore.getState().addWall(makeWall({ id: 'a' }))
    useProjectStore.getState().addWall(makeWall({ id: 'b', x1: 100, x2: 100, y2: 100 }))
    useProjectStore.temporal.getState().undo()
    expect(useProjectStore.getState().walls.map((w) => w.id)).toEqual(['a'])
  })

  it("keeps other walls' object identity on updateWall and ignores an unknown id", () => {
    useProjectStore.getState().addWall(makeWall({ id: 'a' }))
    useProjectStore.getState().addWall(makeWall({ id: 'b' }))
    const [a, b] = useProjectStore.getState().walls

    useProjectStore.getState().updateWall('b', { kind: 'glass' })
    expect(useProjectStore.getState().walls[0]).toBe(a)
    expect(useProjectStore.getState().walls[1]).not.toBe(b)

    useProjectStore.getState().updateWall('missing', { kind: 'glass' })
    expect(useProjectStore.getState().walls[0]).toBe(a)
  })

  it('keeps the redo stack and adds no undo step when the wall id is unknown (stale selection after undo)', () => {
    useProjectStore.getState().addWall(makeWall())
    useProjectStore.temporal.getState().undo()
    const wallsBefore = useProjectStore.getState().walls

    useProjectStore.getState().deleteWall('wall-1')
    useProjectStore.getState().updateWall('wall-1', { kind: 'glass' })

    expect(useProjectStore.getState().walls).toBe(wallsBefore)
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useProjectStore.temporal.getState().futureStates).toHaveLength(1)
    useProjectStore.temporal.getState().redo()
    expect(useProjectStore.getState().walls).toEqual([makeWall()])
  })

  it('clears walls and history on setImage and on resetProject', () => {
    useProjectStore.getState().addWall(makeWall())
    useProjectStore.getState().setImage(OTHER_IMAGE)
    expect(useProjectStore.getState().walls).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)

    useProjectStore.getState().addWall(makeWall())
    useProjectStore.getState().resetProject()
    expect(useProjectStore.getState().walls).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('moves a shared node as one undo step and ignores a move that would collapse a wall', () => {
    useProjectStore.getState().addWall(makeWall({ id: 'a', x1: 0, y1: 0, x2: 100, y2: 0 }))
    useProjectStore.getState().addWall(makeWall({ id: 'b', x1: 100, y1: 0, x2: 100, y2: 100 }))
    const stepsBefore = useProjectStore.temporal.getState().pastStates.length

    useProjectStore.getState().moveWallNode({ x: 100, y: 0 }, { x: 150, y: 20 })
    expect(useProjectStore.getState().walls).toMatchObject([
      { id: 'a', x2: 150, y2: 20 },
      { id: 'b', x1: 150, y1: 20, x2: 100, y2: 100 },
    ])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore + 1)

    const walls = useProjectStore.getState().walls
    useProjectStore.getState().moveWallNode({ x: 150, y: 20 }, { x: 0, y: 0 }) // onto wall a's other end
    expect(useProjectStore.getState().walls).toBe(walls)
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore + 1)

    useProjectStore.temporal.getState().undo()
    expect(useProjectStore.getState().walls).toMatchObject([{ x2: 100, y2: 0 }, { x1: 100, y1: 0 }])
  })

  it('takes its walls from replaceProject', () => {
    useProjectStore.getState().addWall(makeWall({ id: 'old' }))
    useProjectStore
      .getState()
      .replaceProject({ image: OTHER_IMAGE, scale: null, cameras: [], walls: [makeWall({ id: 'new' })], sensors: [], ...createEmptyCableLayout(), ...createEmptyFireAlarmLayout() })
    expect(useProjectStore.getState().walls.map((w) => w.id)).toEqual(['new'])
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
    expect(useProjectStore.getState().sensors).toEqual([makeSensor()])
    undo()
    expect(useProjectStore.getState().sensors).toEqual([])
    redo()
    expect(useProjectStore.getState().sensors).toEqual([makeSensor()])

    updateSensor('sensor-1', { rangeM: 20 })
    expect(useProjectStore.getState().sensors[0]).toMatchObject({ rangeM: 20 })
    undo()
    expect(useProjectStore.getState().sensors[0]).toMatchObject({ rangeM: 10 })
    redo()
    expect(useProjectStore.getState().sensors[0]).toMatchObject({ rangeM: 20 })

    deleteSensor('sensor-1')
    expect(useProjectStore.getState().sensors).toEqual([])
    undo()
    expect(useProjectStore.getState().sensors).toHaveLength(1)
    redo()
    expect(useProjectStore.getState().sensors).toEqual([])
  })

  it('ignores an unknown id on updateSensor/deleteSensor and adds no history step', () => {
    useProjectStore.getState().addSensor(makeSensor())
    const stepsBefore = useProjectStore.temporal.getState().pastStates.length
    const sensorsBefore = useProjectStore.getState().sensors

    useProjectStore.getState().updateSensor('missing', { rangeM: 99 })
    useProjectStore.getState().deleteSensor('missing')

    expect(useProjectStore.getState().sensors).toBe(sensorsBefore)
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore)
  })

  it('adds no history step when the patch is a no-op (nothing in it applies)', () => {
    useProjectStore.getState().addSensor(makeSensor())
    const stepsBefore = useProjectStore.temporal.getState().pastStates.length

    useProjectStore.getState().updateSensor('sensor-1', {})

    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(stepsBefore)
  })

  it('clears sensors and history on setImage and on resetProject', () => {
    useProjectStore.getState().addSensor(makeSensor())
    useProjectStore.getState().setImage(OTHER_IMAGE)
    expect(useProjectStore.getState().sensors).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)

    useProjectStore.getState().addSensor(makeSensor())
    useProjectStore.getState().resetProject()
    expect(useProjectStore.getState().sensors).toEqual([])
    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('takes its sensors from replaceProject', () => {
    useProjectStore.getState().addSensor(makeSensor({ id: 'old' }))
    useProjectStore
      .getState()
      .replaceProject({
        image: OTHER_IMAGE,
        scale: null,
        cameras: [],
        walls: [],
        sensors: [makeSensor({ id: 'new' })],
        ...createEmptyCableLayout(),
        ...createEmptyFireAlarmLayout(),
      })
    expect(useProjectStore.getState().sensors.map((s) => s.id)).toEqual(['new'])
  })
})

describe('useProjectStore undo/redo (zundo)', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
    useProjectStore.temporal.getState().clear()
  })

  it('undoes an add then redoes it', () => {
    useProjectStore.getState().addCamera(makeCamera())
    expect(useProjectStore.getState().cameras).toHaveLength(1)

    useProjectStore.temporal.getState().undo()
    expect(useProjectStore.getState().cameras).toHaveLength(0)

    useProjectStore.temporal.getState().redo()
    expect(useProjectStore.getState().cameras).toHaveLength(1)
  })

  it('undoes a move (updateCamera) back to the prior position', () => {
    useProjectStore.getState().addCamera(makeCamera({ x: 10, y: 10 }))
    useProjectStore.getState().updateCamera('cam-1', { x: 50, y: 60 })
    expect(useProjectStore.getState().cameras[0]).toMatchObject({ x: 50, y: 60 })

    useProjectStore.temporal.getState().undo()
    expect(useProjectStore.getState().cameras[0]).toMatchObject({ x: 10, y: 10 })

    useProjectStore.temporal.getState().redo()
    expect(useProjectStore.getState().cameras[0]).toMatchObject({ x: 50, y: 60 })
  })

  it('sets, clears and undoes mounting height + tilt', () => {
    useProjectStore.getState().addCamera(makeCamera())
    useProjectStore.getState().updateCamera('cam-1', { mountHeightM: 3, tiltDeg: 20 })
    expect(useProjectStore.getState().cameras[0]).toMatchObject({ mountHeightM: 3, tiltDeg: 20 })

    useProjectStore.getState().updateCamera('cam-1', { mountHeightM: undefined, tiltDeg: undefined })
    expect(useProjectStore.getState().cameras[0].mountHeightM).toBeUndefined()
    expect(useProjectStore.getState().cameras[0].tiltDeg).toBeUndefined()

    useProjectStore.temporal.getState().undo()
    expect(useProjectStore.getState().cameras[0]).toMatchObject({ mountHeightM: 3, tiltDeg: 20 })
  })

  it('clears history on replaceProject so undo cannot reach past a different plan', () => {
    useProjectStore.getState().addCamera(makeCamera())
    expect(useProjectStore.temporal.getState().pastStates.length).toBeGreaterThan(0)

    useProjectStore.getState().replaceProject({
      image: { dataUrl: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'other.png' },
      scale: null,
      cameras: [],
      walls: [],
      sensors: [],
      ...createEmptyCableLayout(),
      ...createEmptyFireAlarmLayout(),
    })

    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useProjectStore.temporal.getState().futureStates).toHaveLength(0)
  })
})
