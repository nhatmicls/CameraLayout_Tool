import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CABLE_SETTINGS,
  MAX_HUBS,
  createDefaultCableTypes,
  type Cable,
  type Hub,
} from '../domain/cable/cable-layout-types'
import { buildFloor, buildProjectWithFloors } from '../domain/project-file/project-file-test-fixtures'
import type { PlacedCamera } from '../domain/project-file/project-types'
import type { PlacedBeamSensor } from '../domain/sensor/sensor-types'
import { useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'

const camera: PlacedCamera = { id: 'dev-1', modelId: 'm', x: 10, y: 10, rotationDeg: 0, rangeM: 10 }
// Same id string as the camera on purpose: ids are unique only within a kind.
const beam: PlacedBeamSensor = { id: 'dev-1', modelId: 'b', shape: 'beam', x: 0, y: 0, x2: 100, y2: 0, environment: 'indoor' }
const hub: Hub = { id: 'hub-1', x: 700, y: 500, mountHeightM: 1.5 }
const IMAGE = { dataUrl: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'other.png' }

function makeCable(id: string, device: Cable['device'], hubId = 'hub-1'): Cable {
  return { id, device, hubId, typeId: 'cat6-utp', points: [] }
}

const store = () => useProjectStore.getState()
/** The active floor's own fields (hubs/cables/cameras/sensors) - `cableTypes`/`cableSettings` stay project-level, read straight off `store()`. */
const floor = () => getActiveFloor(store())
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length

/** Camera + beam (same id) + hub, with one camera cable and the beam's tx / rx cables. History cleared afterwards. */
function seedLayout() {
  store().addCamera(camera)
  store().addSensor(beam)
  store().addHub(hub)
  store().addCable(makeCable('k-cam', { kind: 'camera', id: 'dev-1' }))
  store().addCable(makeCable('k-tx', { kind: 'sensor', id: 'dev-1', end: 'tx' }))
  store().addCable(makeCable('k-rx', { kind: 'sensor', id: 'dev-1', end: 'rx' }))
  history().clear()
}

beforeEach(() => {
  store().resetProject()
  history().clear()
})

describe('project store hubs', () => {
  it('adds, updates and deletes a hub, each one undoable step', () => {
    store().addHub(hub)
    expect(steps()).toBe(1)
    store().updateHub('hub-1', { mountHeightM: 2 })
    expect(floor().hubs[0].mountHeightM).toBe(2)
    expect(steps()).toBe(2)
    store().deleteHub('hub-1')
    expect(floor().hubs).toEqual([])
    expect(steps()).toBe(3)

    history().undo()
    expect(floor().hubs[0].mountHeightM).toBe(2)
    history().undo()
    expect(floor().hubs).toEqual([hub])
    history().redo()
    history().redo()
    expect(floor().hubs).toEqual([])
  })

  it('deletes a hub with its cables in ONE step', () => {
    seedLayout()
    store().deleteHub('hub-1')
    expect(floor().hubs).toEqual([])
    expect(floor().cables).toEqual([])
    expect(steps()).toBe(1)
    history().undo()
    expect(floor().hubs).toEqual([hub])
    expect(floor().cables.map((cable) => cable.id)).toEqual(['k-cam', 'k-tx', 'k-rx'])
  })

  it('ignores a hub past MAX_HUBS', () => {
    for (let i = 0; i < MAX_HUBS; i++) store().addHub({ ...hub, id: `hub-${i}` })
    const before = steps()
    store().addHub({ ...hub, id: 'one-too-many' })
    expect(floor().hubs).toHaveLength(MAX_HUBS)
    expect(steps()).toBe(before)
  })
})

describe('project store cascade deletes', () => {
  it('deleteCamera removes its cable but not the cables of a sensor with the same id; one undo restores both', () => {
    seedLayout()
    store().deleteCamera('dev-1')
    expect(floor().cables.map((cable) => cable.id)).toEqual(['k-tx', 'k-rx'])
    expect(steps()).toBe(1)
    history().undo()
    expect(floor().cameras).toEqual([camera])
    expect(floor().cables).toHaveLength(3)
  })

  it('deleteSensor removes both the tx and rx cables of a beam; one undo restores them', () => {
    seedLayout()
    store().deleteSensor('dev-1')
    expect(floor().cables.map((cable) => cable.id)).toEqual(['k-cam'])
    expect(steps()).toBe(1)
    history().undo()
    expect(floor().sensors).toEqual([beam])
    expect(floor().cables).toHaveLength(3)
  })

  it('keeps the cables array identity when the deleted camera has no cable', () => {
    store().addCamera(camera)
    const cables = floor().cables
    store().deleteCamera('dev-1')
    expect(floor().cables).toBe(cables)
  })
})

describe('project store cables', () => {
  it('ignores a cable with an unknown hub or type', () => {
    seedLayout()
    store().addCable(makeCable('bad-hub', { kind: 'camera', id: 'dev-1' }, 'nope'))
    store().addCable({ ...makeCable('bad-type', { kind: 'camera', id: 'dev-1' }), typeId: 'nope' })
    expect(floor().cables).toHaveLength(3)
    expect(steps()).toBe(0)
  })

  it('updates the type and the points, each one step, and refuses an unknown type', () => {
    seedLayout()
    store().updateCable('k-cam', { typeId: 'alarm-signal' })
    store().updateCable('k-cam', { points: [{ x: 1, y: 2 }] })
    expect(floor().cables[0]).toMatchObject({ typeId: 'alarm-signal', points: [{ x: 1, y: 2 }] })
    expect(steps()).toBe(2)
    store().updateCable('k-cam', { typeId: 'nope' })
    expect(steps()).toBe(2)
  })

  it('deletes a cable in one step', () => {
    seedLayout()
    store().deleteCable('k-tx')
    expect(floor().cables.map((cable) => cable.id)).toEqual(['k-cam', 'k-rx'])
    expect(steps()).toBe(1)
  })
})

describe('project store guards: no history step for a refused or empty edit', () => {
  it('unknown ids', () => {
    seedLayout()
    store().updateHub('hub-1', { mountHeightM: 2 })
    history().undo() // leaves one redo step to protect
    const before = steps()
    store().updateHub('nope', { mountHeightM: 2 })
    store().deleteHub('nope')
    store().updateCable('nope', { points: [] })
    store().deleteCable('nope')
    store().updateCableType('nope', { name: 'x' })
    expect(store().deleteCableType('nope')).toBe(false)
    expect(steps()).toBe(before)
    expect(history().futureStates).toHaveLength(1)
  })

  it('no-op patches', () => {
    seedLayout()
    store().updateHub('hub-1', { mountHeightM: hub.mountHeightM })
    store().updateCableSettings({ wastePercent: DEFAULT_CABLE_SETTINGS.wastePercent })
    store().updateCableType('cat6-utp', { name: 'Cat6 UTP' })
    store().updateCable('k-cam', { points: floor().cables[0].points })
    expect(steps()).toBe(0)
  })
})

describe('project store cable types and settings', () => {
  it('adds a type and undoes a price edit', () => {
    store().addCableType({ id: 'fiber', name: 'Fiber', lengthLimitM: null, pricePerMeterVnd: null })
    store().updateCableType('fiber', { pricePerMeterVnd: 12000 })
    store().updateCableType('fiber', { pricePerMeterVnd: 15000 })
    history().undo()
    expect(store().cableTypes.find((type) => type.id === 'fiber')?.pricePerMeterVnd).toBe(12000)
  })

  it('refuses to delete a type in use, deletes an unused one, and keeps the last one', () => {
    seedLayout()
    expect(store().deleteCableType('cat6-utp')).toBe(false)
    expect(steps()).toBe(0)
    expect(store().deleteCableType('power-2-core')).toBe(true)
    expect(steps()).toBe(1)
    expect(store().deleteCableType('alarm-signal')).toBe(true)
    store().deleteHub('hub-1') // frees cat6-utp
    expect(store().deleteCableType('cat6-utp')).toBe(false)
    expect(store().cableTypes.map((type) => type.id)).toEqual(['cat6-utp'])
  })

  it('updates the settings in one step', () => {
    store().updateCableSettings({ wastePercent: 10, routeHeightM: 4 })
    expect(store().cableSettings).toEqual({ ...DEFAULT_CABLE_SETTINGS, wastePercent: 10, routeHeightM: 4 })
    expect(steps()).toBe(1)
  })
})

describe('project store image / project replacement', () => {
  // Rewritten for the floors restructure (drift addendum): `setImage` is now ONE
  // ordinary undo step on the active floor and NEVER clears history (only
  // `resetProject`/`replaceProject` do) - it used to clear history outright.
  it('setImage clears hubs + cables (one undo step, history kept), keeps types + settings', () => {
    seedLayout()
    store().updateCableType('cat6-utp', { pricePerMeterVnd: 8000 })
    store().updateCableSettings({ wastePercent: 10 })
    const stepsBeforeSetImage = steps()
    store().setImage(IMAGE)
    expect(floor().hubs).toEqual([])
    expect(floor().cables).toEqual([])
    expect(store().cableTypes[0].pricePerMeterVnd).toBe(8000)
    expect(store().cableSettings.wastePercent).toBe(10)
    expect(steps()).toBe(stepsBeforeSetImage + 1)

    history().undo()
    expect(floor().hubs).toEqual([hub])
    expect(floor().cables).toHaveLength(3)
  })

  it('resetProject restores the default types and settings', () => {
    store().updateCableType('cat6-utp', { pricePerMeterVnd: 8000 })
    store().updateCableSettings({ wastePercent: 10 })
    store().resetProject()
    expect(store().cableTypes).toEqual(createDefaultCableTypes())
    expect(store().cableSettings).toEqual(DEFAULT_CABLE_SETTINGS)
  })

  it('replaceProject takes all four cable fields from the project', () => {
    const cableTypes = [{ id: 'only', name: 'Only', lengthLimitM: 50, pricePerMeterVnd: 1000 }]
    const cable: Cable = { id: 'k', device: { kind: 'camera', id: 'dev-1' }, hubId: 'hub-1', typeId: 'only', points: [] }
    store().replaceProject(
      buildProjectWithFloors([buildFloor({ image: IMAGE, cameras: [camera], hubs: [hub], cables: [cable] })], {
        cableTypes,
        cableSettings: { ...DEFAULT_CABLE_SETTINGS, clickErrorPx: 5 },
      }),
    )
    expect(floor()).toMatchObject({ hubs: [hub], cables: [cable] })
    expect(store()).toMatchObject({ cableTypes, cableSettings: { clickErrorPx: 5 } })
  })
})
