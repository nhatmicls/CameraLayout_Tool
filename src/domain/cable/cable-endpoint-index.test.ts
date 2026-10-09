import { describe, expect, it } from 'vitest'
import { buildCableEndpointIndex, cableEndRefKey, cableLabel, resolveCableEnd, resolveCablePathPx } from './cable-endpoint-index'
import type { Cable } from './cable-layout-types'
import { BEAM_S2, CABLE_A, CAMERA_C1, CAMERA_C2, HUB_H1, PIR_S1 } from './cable-worked-example.test-fixtures'

const index = buildCableEndpointIndex([CAMERA_C1, CAMERA_C2], [PIR_S1, BEAM_S2], [HUB_H1])

describe('buildCableEndpointIndex', () => {
  it('labels cameras, sensors and hubs by array position', () => {
    expect(index.devices.map((device) => device.label)).toEqual(['C1', 'C2', 'S1', 'S2tx', 'S2rx'])
    expect(index.hubs.map((hub) => hub.label)).toEqual(['H1'])
  })

  it('adds fire-alarm devices after the sensors, labelled with their per-kind designator', () => {
    const withFireAlarm = buildCableEndpointIndex([CAMERA_C1], [PIR_S1], [HUB_H1], undefined, {
      devices: [
        { id: 'fa-1', modelId: 'smoke', x: 11, y: 12 },
        { id: 'fa-2', modelId: 'panel', x: 21, y: 22 },
        { id: 'fa-3', modelId: 'smoke', x: 31, y: 32 },
      ],
      modelById: { smoke: { kind: 'smoke-detector' }, panel: { kind: 'control-panel' } },
    })
    expect(withFireAlarm.devices.map((device) => device.label)).toEqual(['C1', 'S1', 'S1', 'P1', 'S2'])
    expect(withFireAlarm.deviceByKey.get(cableEndRefKey({ kind: 'fire-alarm', id: 'fa-2' }))).toMatchObject({ x: 21, y: 22, mountHeightM: null })
    const cable: Cable = { id: 'k', device: { kind: 'fire-alarm', id: 'fa-2' }, hubId: HUB_H1.id, typeId: 't', points: [] }
    expect(cableLabel(cable, withFireAlarm)).toBe('P1-H1')
    expect(resolveCablePathPx(cable, withFireAlarm)).toEqual([{ x: 21, y: 22 }, { x: HUB_H1.x, y: HUB_H1.y }])
  })

  it('does not resolve a fire-alarm ref when no fire-alarm devices are passed, and falls back to "F{n}" without a catalog lookup', () => {
    expect(index.deviceByKey.get(cableEndRefKey({ kind: 'fire-alarm', id: 'fa-1' }))).toBeUndefined()
    const noCatalog = buildCableEndpointIndex([], [], [], undefined, { devices: [{ id: 'fa-1', modelId: 'smoke', x: 0, y: 0 }] })
    expect(noCatalog.devices.map((device) => device.label)).toEqual(['F1'])
  })

  it('yields two ends for a beam, at its transmitter and receiver', () => {
    expect(index.deviceByKey.get(cableEndRefKey({ kind: 'sensor', id: 'beam-1', end: 'tx' }))).toMatchObject({ x: 200, y: 600 })
    expect(index.deviceByKey.get(cableEndRefKey({ kind: 'sensor', id: 'beam-1', end: 'rx' }))).toMatchObject({ x: 500, y: 600 })
  })

  it('numbers hubs, risers and drops each on their own', () => {
    const mixed = buildCableEndpointIndex(
      [],
      [],
      [HUB_H1, { ...HUB_H1, id: 'r', kind: 'riser' }, { ...HUB_H1, id: 'd', kind: 'drop' }, { ...HUB_H1, id: 'h2' }, { ...HUB_H1, id: 'd2', kind: 'drop' }],
    )
    expect(mixed.hubs.map((hub) => hub.label)).toEqual(['H1', 'R1', 'D1', 'H2', 'D2'])
  })

  it('gives a drop a negative height (it ends below this floor) and carries the length beyond', () => {
    const index2 = buildCableEndpointIndex([], [], [{ id: 'd', kind: 'drop', x: 0, y: 0, mountHeightM: 2, extraLengthM: 7 }, HUB_H1])
    expect(index2.hubs.map((hub) => [hub.mountHeightM, hub.extraLengthM])).toEqual([[-2, 7], [1.5, 0]])
  })

  it('carries a camera mounting height and null for everything without one', () => {
    expect(index.devices.map((device) => device.mountHeightM)).toEqual([2.5, null, null, null, null])
  })

  it('keeps the first entry of a repeated camera id', () => {
    const twin = buildCableEndpointIndex([CAMERA_C1, { ...CAMERA_C1, x: 999 }], [], [])
    expect(twin.deviceByKey.get(cableEndRefKey({ kind: 'camera', id: 'cam-1' }))).toMatchObject({ x: 100, label: 'C1' })
  })

  it('never confuses a camera with a sensor of the same id', () => {
    expect(cableEndRefKey({ kind: 'camera', id: 'a' })).not.toBe(cableEndRefKey({ kind: 'sensor', id: 'a' }))
  })
})

describe('resolveCablePathPx + cableLabel', () => {
  it('returns device, intermediate points, hub', () => {
    expect(resolveCablePathPx(CABLE_A, index)).toEqual([
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 400, y: 500 },
      { x: 700, y: 500 },
    ])
    expect(cableLabel(CABLE_A, index)).toBe('C1-H1')
  })

  it('labels a beam end', () => {
    const cable: Cable = { ...CABLE_A, device: { kind: 'sensor', id: 'beam-1', end: 'tx' } }
    expect(cableLabel(cable, index)).toBe('S2tx-H1')
  })

  it('returns null and a "?" label for a dangling end', () => {
    const noHub: Cable = { ...CABLE_A, hubId: 'gone' }
    const noDevice: Cable = { ...CABLE_A, device: { kind: 'camera', id: 'gone' } }
    expect(resolveCablePathPx(noHub, index)).toBeNull()
    expect(resolveCablePathPx(noDevice, index)).toBeNull()
    expect(cableLabel(noHub, index)).toBe('C1-?')
    expect(cableLabel(noDevice, index)).toBe('?-H1')
  })

  it('ignores a shaft end label for a cable that ends on an ordinary hub', () => {
    expect(cableLabel(CABLE_A, index)).toBe('C1-H1')
    expect(cableLabel(CABLE_A, index, 'H9')).toBe('C1-H1')
  })

  it('labels a cable through a shaft by where it goes beyond it: "C1-?" until routed, then the far end, never the shaft', () => {
    const withShaft = buildCableEndpointIndex([CAMERA_C1], [], [HUB_H1, { id: 'sm', kind: 'shaft', shaftId: 's1', x: 9, y: 9, mountHeightM: 0 }], ['s1'])
    const cable: Cable = { ...CABLE_A, hubId: 'sm' }
    expect(withShaft.hubById.get('sm')).toMatchObject({ label: 'T1', isShaft: true })
    expect(cableLabel(cable, withShaft)).toBe('C1-?')
    expect(cableLabel(cable, withShaft, 'H2')).toBe('C1-H2')
  })

  it('resolves a cable that ends on another device: path, label "C1-C2", and null when that device is gone', () => {
    const toCamera: Cable = { id: 'k', device: { kind: 'camera', id: 'cam-1' }, endDevice: { kind: 'camera', id: 'cam-2' }, typeId: 't', points: [{ x: 5, y: 5 }] }
    expect(resolveCablePathPx(toCamera, index)).toEqual([{ x: 100, y: 100 }, { x: 5, y: 5 }, { x: 100, y: 300 }])
    expect(cableLabel(toCamera, index)).toBe('C1-C2')
    expect(resolveCableEnd(toCamera, index)).toMatchObject({ kind: 'device', label: 'C2' })
    const toBeamRx: Cable = { ...toCamera, endDevice: { kind: 'sensor', id: 'beam-1', end: 'rx' } }
    expect(cableLabel(toBeamRx, index)).toBe('C1-S2rx')
    const gone: Cable = { ...toCamera, endDevice: { kind: 'camera', id: 'nope' } }
    expect(resolveCablePathPx(gone, index)).toBeNull()
    expect(cableLabel(gone, index)).toBe('C1-?')
  })
})

describe('hubLabels - shaft markers', () => {
  it('labels a shaft marker "T{n}" from its position in the project shafts[] list, not a local count', () => {
    const hubs = [
      HUB_H1,
      { id: 'm-shaft-b', kind: 'shaft' as const, shaftId: 'shaft-b', x: 0, y: 0, mountHeightM: 0 },
      { id: 'm-shaft-a', kind: 'shaft' as const, shaftId: 'shaft-a', x: 0, y: 0, mountHeightM: 0 },
    ]
    // shaft-a is listed FIRST in the project, even though its marker on THIS floor comes second.
    const labels = buildCableEndpointIndex([], [], hubs, ['shaft-a', 'shaft-b']).hubs.map((hub) => hub.label)
    expect(labels).toEqual(['H1', 'T2', 'T1'])
  })
})
