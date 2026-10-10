import { describe, expect, it } from 'vitest'
import { createEmptyFloor, type Floor } from '../floor/floor-types'
import { resolveFireAlarmDeviceLabel } from './fire-alarm-device-label-by-id'

function floorWith(id: string, name: string, deviceIds: string[]): Floor {
  return {
    ...createEmptyFloor(id, name),
    fireAlarmDevices: deviceIds.map((deviceId) => ({ id: deviceId, modelId: 'm', x: 0, y: 0 })),
  }
}

describe('resolveFireAlarmDeviceLabel', () => {
  const f1 = floorWith('f1', 'Floor 1', ['a', 'b'])
  const f2 = floorWith('f2', 'Floor 2', ['c'])
  const floors = [f1, f2]

  it('all-floors view: floor-prefixes by project order, matching the merged BOM row labels', () => {
    expect(resolveFireAlarmDeviceLabel(floors, 'a', {})).toBe('F1_?1')
    expect(resolveFireAlarmDeviceLabel(floors, 'b', {})).toBe('F1_?2')
    expect(resolveFireAlarmDeviceLabel(floors, 'c', {})).toBe('F2_?1')
  })

  it('single-floor view (`floorId` given): still floor-prefixed - matches that floor\'s own BOM rows (owner decision 2026-10-09)', () => {
    expect(resolveFireAlarmDeviceLabel(floors, 'c', {}, 'f2')).toBe('F2_?1')
  })

  it('single-floor view: null for a device on a DIFFERENT floor than the one in scope', () => {
    expect(resolveFireAlarmDeviceLabel(floors, 'a', {}, 'f2')).toBeNull()
  })

  it('null for an unknown/deleted device id', () => {
    expect(resolveFireAlarmDeviceLabel(floors, 'does-not-exist', {})).toBeNull()
  })

  it('a true one-floor project is still floor-prefixed (owner decision 2026-10-09)', () => {
    expect(resolveFireAlarmDeviceLabel([f1], 'a', {})).toBe('F1_?1')
  })
})
