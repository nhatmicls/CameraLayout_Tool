import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from './project-store'
import type { PlacedCamera } from '../domain/project-types'

function makeCamera(overrides: Partial<PlacedCamera> = {}): PlacedCamera {
  return { id: 'cam-1', modelId: 'hik-dome-2.8', x: 10, y: 10, rotationDeg: 0, rangeM: 10, ...overrides }
}

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
    })

    expect(useProjectStore.temporal.getState().pastStates).toHaveLength(0)
    expect(useProjectStore.temporal.getState().futureStates).toHaveLength(0)
  })
})
