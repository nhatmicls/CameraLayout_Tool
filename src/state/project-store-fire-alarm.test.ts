import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyCableLayout } from '../domain/cable/cable-layout-types'
import { DEFAULT_FIRE_ALARM_SETTINGS, type PlacedFireAlarmDevice } from '../domain/fire-alarm/fire-alarm-device-types'
import { useProjectStore } from './project-store'

const device: PlacedFireAlarmDevice = { id: 'f1', modelId: 'panel-1', x: 10, y: 20 }

const store = () => useProjectStore.getState()
const history = () => useProjectStore.temporal.getState()
const steps = () => history().pastStates.length

beforeEach(() => {
  store().resetProject()
  history().clear()
})

describe('project store fire-alarm devices', () => {
  it('adds, updates and deletes a device, each undoable and redoable', () => {
    store().addFireAlarmDevice(device)
    expect(store().fireAlarmDevices).toEqual([device])

    store().updateFireAlarmDevice('f1', { x: 99 })
    expect(store().fireAlarmDevices[0]).toMatchObject({ x: 99 })

    store().deleteFireAlarmDevice('f1')
    expect(store().fireAlarmDevices).toEqual([])
    expect(steps()).toBe(3)

    history().undo()
    expect(store().fireAlarmDevices[0]).toMatchObject({ x: 99 })
    history().undo()
    expect(store().fireAlarmDevices[0]).toMatchObject({ x: 10 })
    history().undo()
    expect(store().fireAlarmDevices).toEqual([])

    history().redo()
    history().redo()
    history().redo()
    expect(store().fireAlarmDevices).toEqual([])
  })

  it('ignores an unknown id on updateFireAlarmDevice/deleteFireAlarmDevice and adds no history step', () => {
    store().addFireAlarmDevice(device)
    const before = steps()
    const devicesBefore = store().fireAlarmDevices

    store().updateFireAlarmDevice('missing', { x: 5 })
    store().deleteFireAlarmDevice('missing')

    expect(store().fireAlarmDevices).toBe(devicesBefore)
    expect(steps()).toBe(before)
  })

  it('adds no history step when the patch is a no-op', () => {
    store().addFireAlarmDevice(device)
    const before = steps()

    store().updateFireAlarmDevice('f1', { x: device.x, y: device.y })

    expect(steps()).toBe(before)
  })

  it('clears devices and settings and history on setImage and on resetProject', () => {
    store().addFireAlarmDevice(device)
    store().setFireAlarmSettings({ coverageMode: 'tcvn-5738', ceilingHeightM: 3 })
    store().setImage({ dataUrl: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'other.png' })
    expect(store().fireAlarmDevices).toEqual([])
    expect(store().fireAlarmSettings).toEqual(DEFAULT_FIRE_ALARM_SETTINGS)
    expect(history().pastStates).toHaveLength(0)

    store().addFireAlarmDevice(device)
    store().resetProject()
    expect(store().fireAlarmDevices).toEqual([])
    expect(store().fireAlarmSettings).toEqual(DEFAULT_FIRE_ALARM_SETTINGS)
    expect(history().pastStates).toHaveLength(0)
  })

  it('takes its devices and settings from replaceProject', () => {
    store().addFireAlarmDevice({ ...device, id: 'old' })
    store().replaceProject({
      image: { dataUrl: 'data:image/png;base64,AA==', widthPx: 10, heightPx: 10, fileName: 'other.png' },
      scale: null,
      cameras: [],
      walls: [],
      sensors: [],
      ...createEmptyCableLayout(),
      fireAlarmDevices: [{ ...device, id: 'new' }],
      fireAlarmSettings: { coverageMode: 'tcvn-5738', ceilingHeightM: 2.8 },
    })
    expect(store().fireAlarmDevices.map((d) => d.id)).toEqual(['new'])
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
