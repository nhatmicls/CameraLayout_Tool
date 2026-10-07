import { describe, expect, it } from 'vitest'
import type { PlacedFireAlarmDevice } from './fire-alarm-device-types'
import { applyPlacedFireAlarmDevicePatch, buildPlacedFireAlarmDeviceAtDrop } from './placed-fire-alarm-device-builder-and-patch'

describe('buildPlacedFireAlarmDeviceAtDrop', () => {
  it('builds a device with exactly id/modelId/x/y at the drop point', () => {
    const device = buildPlacedFireAlarmDeviceAtDrop({ id: 'f1', modelId: 'hikvision-ds-pdsmk-s-we', x: 12, y: 34 })
    expect(device).toEqual({ id: 'f1', modelId: 'hikvision-ds-pdsmk-s-we', x: 12, y: 34 })
  })
})

describe('applyPlacedFireAlarmDevicePatch', () => {
  const device: PlacedFireAlarmDevice = { id: 'f1', modelId: 'hikvision-ds-pdsmk-s-we', x: 10, y: 20 }

  it('returns the same reference for an empty patch', () => {
    expect(applyPlacedFireAlarmDevicePatch(device, {})).toBe(device)
  })

  it('returns the same reference when the patch repeats the current values', () => {
    expect(applyPlacedFireAlarmDevicePatch(device, { x: 10, y: 20 })).toBe(device)
  })

  it('returns a new object with only the changed field updated', () => {
    const moved = applyPlacedFireAlarmDevicePatch(device, { x: 99 })
    expect(moved).not.toBe(device)
    expect(moved).toEqual({ id: 'f1', modelId: 'hikvision-ds-pdsmk-s-we', x: 99, y: 20 })
  })

  it('applies both x and y together', () => {
    const moved = applyPlacedFireAlarmDevicePatch(device, { x: 1, y: 2 })
    expect(moved).toEqual({ id: 'f1', modelId: 'hikvision-ds-pdsmk-s-we', x: 1, y: 2 })
  })
})
