import { describe, expect, it } from 'vitest'
import { normaliseLoadedFireAlarmDevices, placedFireAlarmDeviceSchema } from './project-file-fire-alarm-schema'

const KNOWN_MODEL_IDS = new Set(['smoke-1', 'panel-1'])

describe('placedFireAlarmDeviceSchema', () => {
  it('accepts a minimal device', () => {
    expect(placedFireAlarmDeviceSchema.safeParse({ id: 'f1', modelId: 'smoke-1', x: 10, y: 20 }).success).toBe(true)
  })

  it('rejects an extra key (strict object)', () => {
    expect(placedFireAlarmDeviceSchema.safeParse({ id: 'f1', modelId: 'smoke-1', x: 10, y: 20, extra: 1 }).success).toBe(false)
  })

  it('rejects a non-finite coordinate', () => {
    expect(placedFireAlarmDeviceSchema.safeParse({ id: 'f1', modelId: 'smoke-1', x: 'NaN', y: 20 }).success).toBe(false)
  })

  it('rejects an empty id or modelId', () => {
    expect(placedFireAlarmDeviceSchema.safeParse({ id: '', modelId: 'smoke-1', x: 0, y: 0 }).success).toBe(false)
    expect(placedFireAlarmDeviceSchema.safeParse({ id: 'f1', modelId: '', x: 0, y: 0 }).success).toBe(false)
  })
})

describe('normaliseLoadedFireAlarmDevices', () => {
  it('keeps every device whose modelId is known and whose id is unique', () => {
    const devices = [
      { id: 'f1', modelId: 'smoke-1', x: 0, y: 0 },
      { id: 'f2', modelId: 'panel-1', x: 10, y: 10 },
    ]
    const warnings: string[] = []
    expect(normaliseLoadedFireAlarmDevices(devices, KNOWN_MODEL_IDS, warnings)).toEqual(devices)
    expect(warnings).toEqual([])
  })

  it('drops a device referencing an unknown modelId, with a warning', () => {
    const warnings: string[] = []
    const result = normaliseLoadedFireAlarmDevices([{ id: 'f1', modelId: 'does-not-exist', x: 0, y: 0 }], KNOWN_MODEL_IDS, warnings)
    expect(result).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('does-not-exist')
  })

  it('drops a repeated id, keeping the first', () => {
    const first = { id: 'dup', modelId: 'smoke-1', x: 0, y: 0 }
    const second = { id: 'dup', modelId: 'panel-1', x: 5, y: 5 }
    const warnings: string[] = []
    const result = normaliseLoadedFireAlarmDevices([first, second], KNOWN_MODEL_IDS, warnings)
    expect(result).toEqual([first])
    expect(warnings).toHaveLength(1)
  })
})
