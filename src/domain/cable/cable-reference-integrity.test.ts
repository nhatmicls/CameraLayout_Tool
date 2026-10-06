import { describe, expect, it } from 'vitest'
import type { Cable } from './cable-layout-types'
import {
  cableRefProblem,
  isCableTypeInUse,
  removeCablesOfDevice,
  removeCablesOfHub,
  type CableRefContext,
} from './cable-reference-integrity'

const cameraCable: Cable = { id: 'k1', device: { kind: 'camera', id: 'a' }, hubId: 'h1', typeId: 't1', points: [] }
const sensorCable: Cable = { id: 'k2', device: { kind: 'sensor', id: 'a' }, hubId: 'h1', typeId: 't1', points: [] }
const beamTx: Cable = { id: 'k3', device: { kind: 'sensor', id: 'b', end: 'tx' }, hubId: 'h2', typeId: 't2', points: [] }
const beamRx: Cable = { id: 'k4', device: { kind: 'sensor', id: 'b', end: 'rx' }, hubId: 'h2', typeId: 't2', points: [] }
const all = [cameraCable, sensorCable, beamTx, beamRx]

describe('removeCablesOfDevice', () => {
  it('removes the camera cable but not a sensor with the same id string', () => {
    expect(removeCablesOfDevice(all, 'camera', 'a')).toEqual([sensorCable, beamTx, beamRx])
  })

  it('removes both the tx and rx cables of a beam', () => {
    expect(removeCablesOfDevice(all, 'sensor', 'b')).toEqual([cameraCable, sensorCable])
  })

  it('returns the same array when nothing matches', () => {
    expect(removeCablesOfDevice(all, 'camera', 'nope')).toBe(all)
  })
})

describe('removeCablesOfHub', () => {
  it('removes every cable of the hub', () => {
    expect(removeCablesOfHub(all, 'h2')).toEqual([cameraCable, sensorCable])
  })

  it('returns the same array when nothing matches', () => {
    expect(removeCablesOfHub(all, 'nope')).toBe(all)
  })
})

describe('isCableTypeInUse', () => {
  it('is true for a used type and false otherwise', () => {
    expect(isCableTypeInUse(all, 't2')).toBe(true)
    expect(isCableTypeInUse(all, 't3')).toBe(false)
  })
})

describe('cableRefProblem', () => {
  const ctx: CableRefContext = {
    cameraIds: new Set(['a']),
    sensorShapeById: new Map([
      ['a', 'sector'],
      ['b', 'beam'],
    ]),
    hubIds: new Set(['h1', 'h2']),
    typeIds: new Set(['t1', 't2']),
  }

  it('accepts resolvable refs', () => {
    for (const cable of all) expect(cableRefProblem(cable, ctx)).toBeNull()
  })

  it('reports an unknown hub, type, camera and sensor', () => {
    expect(cableRefProblem({ ...cameraCable, hubId: 'x' }, ctx)).toContain('unknown hub')
    expect(cableRefProblem({ ...cameraCable, typeId: 'x' }, ctx)).toContain('unknown cable type')
    expect(cableRefProblem({ ...cameraCable, device: { kind: 'camera', id: 'x' } }, ctx)).toContain('unknown camera')
    expect(cableRefProblem({ ...sensorCable, device: { kind: 'sensor', id: 'x' } }, ctx)).toContain('unknown sensor')
  })

  it('requires an end on a beam and forbids one elsewhere', () => {
    expect(cableRefProblem({ ...beamTx, device: { kind: 'sensor', id: 'b' } }, ctx)).toContain('without naming an end')
    expect(cableRefProblem({ ...sensorCable, device: { kind: 'sensor', id: 'a', end: 'tx' } }, ctx)).toContain('not a beam')
  })
})
