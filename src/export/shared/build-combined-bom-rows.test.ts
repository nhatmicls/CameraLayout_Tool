import { describe, expect, it } from 'vitest'
import { buildCombinedBomRows, type BomProjectSlice } from './build-combined-bom-rows'
import { createEmptyCableLayout } from '../../domain/cable/cable-layout-types'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import type { PlacedSectorSensor } from '../../domain/sensor/sensor-types'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'

// Real catalog ids (the loaders are the one place `src/catalog` may be read from - this test
// goes through `buildCombinedBomRows`, which reads the real bundled catalogs, same as the app).
const CAMERA_MODEL_ID = 'hikvision-ds-2cd2t47g2-l-2.8mm'
const SENSOR_MODEL_ID = 'hikvision-ds-pdpg12p-eg2-pir'
const HUB_MODEL_ID = 'hikvision-ds-pwa96-m2h-wb' // empty compatibleDevices in the real catalog
const SMOKE_MODEL_ID = 'hikvision-ds-pdsmk-s-we' // listed for hikvision-ds-pwa96-m-we, not for the m2h-wb hub above

function baseProject(overrides: Partial<BomProjectSlice> = {}): BomProjectSlice {
  return {
    cameras: [],
    sensors: [],
    fireAlarmDevices: [],
    scale: null,
    ...createEmptyCableLayout(),
    ...overrides,
  }
}

function camera(id: string, modelId: string): PlacedCamera {
  return { id, modelId, x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function sectorSensor(id: string, modelId: string): PlacedSectorSensor {
  return { id, modelId, shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function fireDevice(id: string, modelId: string): PlacedFireAlarmDevice {
  return { id, modelId, x: 0, y: 0 }
}

describe('buildCombinedBomRows', () => {
  it('returns no rows and no warnings for an empty project', () => {
    const result = buildCombinedBomRows(baseProject())
    expect(result.allRows).toEqual([])
    expect(result.fireAlarmWarnings).toEqual([])
  })

  it('orders allRows as cameras, then sensors, then fire-alarm devices, then cables (no scale = no cable rows)', () => {
    const result = buildCombinedBomRows(
      baseProject({
        cameras: [camera('cam-1', CAMERA_MODEL_ID)],
        sensors: [sectorSensor('sensor-1', SENSOR_MODEL_ID)],
        fireAlarmDevices: [fireDevice('fire-1', SMOKE_MODEL_ID)],
      }),
    )
    expect(result.allRows.map((r) => r.type)).toEqual([result.cameraRows[0].type, result.sensorRows[0].type, result.fireAlarmRows[0].type])
    expect(result.allRows).toHaveLength(3)
  })

  it('flags a detector not listed for the one placed hub, and reuses that warning for the row note', () => {
    const result = buildCombinedBomRows(
      baseProject({
        fireAlarmDevices: [fireDevice('fire-hub', HUB_MODEL_ID), fireDevice('fire-smoke', SMOKE_MODEL_ID)],
      }),
    )
    expect(result.fireAlarmWarnings).toEqual([
      { code: 'not-listed-for-placed-controllers', deviceId: 'fire-smoke', modelId: SMOKE_MODEL_ID },
    ])
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('Not listed for a placed panel/hub: F2')
  })

  it('has no fire-alarm rows or warnings without any fire-alarm devices', () => {
    const result = buildCombinedBomRows(baseProject({ cameras: [camera('cam-1', CAMERA_MODEL_ID)] }))
    expect(result.fireAlarmRows).toEqual([])
    expect(result.fireAlarmWarnings).toEqual([])
  })
})
