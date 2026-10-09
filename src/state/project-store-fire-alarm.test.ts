import { beforeEach, describe, expect, it } from 'vitest'
import { buildFloor, buildProjectWithFloors } from '../domain/project-file/project-file-test-fixtures'
import { DEFAULT_FIRE_ALARM_SETTINGS, type PlacedFireAlarmDevice } from '../domain/fire-alarm/fire-alarm-device-types'
import { useProjectStore } from './project-store'
import { getActiveFloor } from './project-store-floor-selectors'

const device: PlacedFireAlarmDevice = { id: 'f1', modelId: 'panel-1', x: 10, y: 20 }
const IMAGE = { dataUrl: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'other.png' }

const store = () => useProjectStore.getState()
/** The active floor's own `fireAlarmDevices` - `fireAlarmSettings` stays project-level, read straight off `store()`. */
const floor = () => getActiveFloor(store())
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length

beforeEach(() => {
  store().resetProject()
  history().clear()
})

describe('project store fire-alarm devices', () => {
  it('adds, updates and deletes a device, each undoable and redoable', () => {
    store().addFireAlarmDevice(device)
    expect(floor().fireAlarmDevices).toEqual([device])

    store().updateFireAlarmDevice('f1', { x: 99 })
    expect(floor().fireAlarmDevices[0]).toMatchObject({ x: 99 })

    store().deleteFireAlarmDevice('f1')
    expect(floor().fireAlarmDevices).toEqual([])
    expect(steps()).toBe(3)

    history().undo()
    expect(floor().fireAlarmDevices[0]).toMatchObject({ x: 99 })
    history().undo()
    expect(floor().fireAlarmDevices[0]).toMatchObject({ x: 10 })
    history().undo()
    expect(floor().fireAlarmDevices).toEqual([])

    history().redo()
    history().redo()
    history().redo()
    expect(floor().fireAlarmDevices).toEqual([])
  })

  it('deleting a device removes its cables in the same undo step, and leaves other cables alone', () => {
    store().addFireAlarmDevice(device)
    store().addCamera({ id: 'f1', modelId: 'm', x: 0, y: 0, rotationDeg: 0, rangeM: 10 })
    store().addHub({ id: 'h1', x: 5, y: 5, mountHeightM: 1.5 })
    const typeId = store().cableTypes[0].id
    store().addCable({ id: 'k-fa', device: { kind: 'fire-alarm', id: 'f1' }, hubId: 'h1', typeId, points: [] })
    store().addCable({ id: 'k-cam', device: { kind: 'camera', id: 'f1' }, hubId: 'h1', typeId, points: [] })
    const before = steps()

    store().deleteFireAlarmDevice('f1')
    expect(floor().cables.map((cable) => cable.id)).toEqual(['k-cam'])
    expect(steps()).toBe(before + 1)

    history().undo()
    expect(floor().fireAlarmDevices).toEqual([device])
    expect(floor().cables.map((cable) => cable.id)).toEqual(['k-fa', 'k-cam'])
  })

  it('ignores an unknown id on updateFireAlarmDevice/deleteFireAlarmDevice and adds no history step', () => {
    store().addFireAlarmDevice(device)
    const before = steps()
    const devicesBefore = floor().fireAlarmDevices

    store().updateFireAlarmDevice('missing', { x: 5 })
    store().deleteFireAlarmDevice('missing')

    expect(floor().fireAlarmDevices).toBe(devicesBefore)
    expect(steps()).toBe(before)
  })

  it('adds no history step when the patch is a no-op', () => {
    store().addFireAlarmDevice(device)
    const before = steps()

    store().updateFireAlarmDevice('f1', { x: device.x, y: device.y })

    expect(steps()).toBe(before)
  })

  // Rewritten for the floors restructure (drift addendum): `setImage` clears the active
  // floor's `fireAlarmDevices` (like cameras/sensors/hubs/cables) but `fireAlarmSettings` is
  // now PROJECT-level (shared by every floor), so it is no longer reset here, and `setImage`
  // is one ordinary undo step - it no longer clears history (only `resetProject`/
  // `replaceProject` do).
  it('setImage clears the active floor\'s devices but keeps fireAlarmSettings and history', () => {
    store().addFireAlarmDevice(device)
    store().setFireAlarmSettings({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    const stepsBeforeSetImage = steps()

    store().setImage(IMAGE)

    expect(floor().fireAlarmDevices).toEqual([])
    expect(store().fireAlarmSettings).toEqual({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    expect(steps()).toBe(stepsBeforeSetImage + 1)

    history().undo()
    expect(floor().fireAlarmDevices).toEqual([device])
  })

  it('resetProject clears devices, settings and history', () => {
    store().addFireAlarmDevice(device)
    store().setFireAlarmSettings({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })

    store().resetProject()

    expect(floor().fireAlarmDevices).toEqual([])
    expect(store().fireAlarmSettings).toEqual(DEFAULT_FIRE_ALARM_SETTINGS)
    expect(history().pastStates).toHaveLength(0)
  })

  it('takes its devices and settings from replaceProject', () => {
    store().addFireAlarmDevice({ ...device, id: 'old' })
    store().replaceProject(
      buildProjectWithFloors([buildFloor({ image: IMAGE, fireAlarmDevices: [{ ...device, id: 'new' }] })], {
        fireAlarmSettings: { coverageMode: 'tcvn-5738', ceilingHeightM: 2.8 },
      }),
    )
    expect(floor().fireAlarmDevices.map((d) => d.id)).toEqual(['new'])
    expect(store().fireAlarmSettings).toEqual({ coverageMode: 'tcvn-5738', ceilingHeightM: 2.8 })
  })
})

describe('project store fire-alarm settings', () => {
  it('updates settings as one undoable step and is a no-op when nothing changes', () => {
    store().setFireAlarmSettings({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    expect(store().fireAlarmSettings).toEqual({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    expect(steps()).toBe(1)

    const before = steps()
    store().setFireAlarmSettings({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    expect(steps()).toBe(before)

    history().undo()
    expect(store().fireAlarmSettings).toEqual(DEFAULT_FIRE_ALARM_SETTINGS)
  })

  it('ignores an explicit undefined patch value instead of clobbering the current value', () => {
    store().setFireAlarmSettings({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    const before = steps()

    store().setFireAlarmSettings({ coverageMode: 'datasheet', ceilingHeightM: undefined })

    expect(store().fireAlarmSettings).toEqual({ coverageMode: 'datasheet', ceilingHeightM: 3 })
    expect(steps()).toBe(before + 1)
  })
})
