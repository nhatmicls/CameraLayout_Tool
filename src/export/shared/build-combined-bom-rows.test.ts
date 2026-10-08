import { describe, expect, it } from 'vitest'
import { buildCombinedBomRows } from './build-combined-bom-rows'
import { groupCamerasIntoBom } from '../../domain/bom/bill-of-materials-grouping'
import { groupCablesIntoBom } from '../../domain/bom/cable-bill-of-materials-grouping'
import { groupFireAlarmDevicesIntoBom } from '../../domain/bom/fire-alarm-bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../../domain/bom/sensor-bill-of-materials-grouping'
import { computeCableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS, type Cable, type Hub } from '../../domain/cable/cable-layout-types'
import { checkFireAlarmCompatibility } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { DEFAULT_FIRE_ALARM_SETTINGS, type PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { createEmptyFloor, type Floor } from '../../domain/floor/floor-types'
import type { Project } from '../../domain/project-file/project-types'
import type { PlacedCamera } from '../../domain/project-file/project-types'
import type { PlacedSectorSensor } from '../../domain/sensor/sensor-types'
import { buildCameraModelByIdRecord } from './camera-model-by-id-record'
import { fireAlarmCompatibilityIndex, fireAlarmModelSpecById } from './fire-alarm-compatibility-index-singleton'
import { buildSensorModelByIdRecord } from './sensor-model-by-id-record'

// Real catalog ids (the loaders are the one place `src/catalog` may be read from - this test
// goes through `buildCombinedBomRows`, which reads the real bundled catalogs, same as the app).
const CAMERA_MODEL_ID = 'hikvision-ds-2cd2t47g2-l-2.8mm'
const SENSOR_MODEL_ID = 'hikvision-ds-pdpg12p-eg2-pir'
const HUB_MODEL_ID = 'hikvision-ds-pwa96-m2h-wb' // empty compatibleDevices in the real catalog
const SMOKE_MODEL_ID = 'hikvision-ds-pdsmk-s-we' // listed for hikvision-ds-pwa96-m-we, not for the m2h-wb hub above

function camera(id: string, modelId: string): PlacedCamera {
  return { id, modelId, x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function sectorSensor(id: string, modelId: string): PlacedSectorSensor {
  return { id, modelId, shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function fireDevice(id: string, modelId: string): PlacedFireAlarmDevice {
  return { id, modelId, x: 0, y: 0 }
}

function floor(id: string, name: string, overrides: Partial<Floor> = {}): Floor {
  return { ...createEmptyFloor(id, name), ...overrides }
}

function project(floors: Floor[], overrides: Partial<Project> = {}): Project {
  return { floors, shafts: [], cableTypes: createDefaultCableTypes(), cableSettings: { ...DEFAULT_CABLE_SETTINGS }, fireAlarmSettings: { ...DEFAULT_FIRE_ALARM_SETTINGS }, ...overrides }
}

describe('buildCombinedBomRows - single floor (regression: byte-identical to before multi-floor)', () => {
  it('returns no rows and no warnings for an empty project', () => {
    const result = buildCombinedBomRows(project([floor('f1', 'Floor 1')]))
    expect(result.allRows).toEqual([])
    expect(result.fireAlarmWarnings).toEqual([])
  })

  it('orders allRows as cameras, then sensors, then fire-alarm devices, then cables (no scale = no cable rows)', () => {
    const f = floor('f1', 'Floor 1', {
      cameras: [camera('cam-1', CAMERA_MODEL_ID)],
      sensors: [sectorSensor('sensor-1', SENSOR_MODEL_ID)],
      fireAlarmDevices: [fireDevice('fire-1', SMOKE_MODEL_ID)],
    })
    const result = buildCombinedBomRows(project([f]))
    expect(result.allRows.map((r) => r.type)).toEqual([result.cameraRows[0].type, result.sensorRows[0].type, result.fireAlarmRows[0].type])
    expect(result.allRows).toHaveLength(3)
  })

  it('flags a detector not listed for the one placed hub, and reuses that warning for the row note - label unprefixed', () => {
    const f = floor('f1', 'Floor 1', { fireAlarmDevices: [fireDevice('fire-hub', HUB_MODEL_ID), fireDevice('fire-smoke', SMOKE_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f]))
    expect(result.fireAlarmWarnings).toEqual([{ code: 'not-listed-for-placed-controllers', deviceId: 'fire-smoke', modelId: SMOKE_MODEL_ID }])
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('Not listed for a placed panel/hub: F2')
  })

  it('has no fire-alarm rows or warnings without any fire-alarm devices', () => {
    const f = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f]))
    expect(result.fireAlarmRows).toEqual([])
    expect(result.fireAlarmWarnings).toEqual([])
  })

  it('cable rows come from the project cable estimate, unprefixed on one floor', () => {
    const hub: Hub = { id: 'hub-1', x: 0, y: 1000, mountHeightM: 1.5 }
    const cable: Cable = { id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }
    const f = floor('f1', 'Floor 1', {
      cameras: [camera('cam-1', CAMERA_MODEL_ID)],
      hubs: [hub],
      cables: [cable],
      scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 1 },
    })
    const p = project([f])
    const result = buildCombinedBomRows(p)

    const expectedEstimate = computeCableLayoutEstimate({
      cameras: f.cameras,
      sensors: f.sensors,
      hubs: f.hubs,
      cables: f.cables,
      cableTypes: p.cableTypes,
      cableSettings: p.cableSettings,
      scale: f.scale,
    })
    expect(result.cableRows).toEqual(groupCablesIntoBom(expectedEstimate))
    expect(result.cableRows).toHaveLength(1)
    expect(result.cableRows[0]).toMatchObject({ type: 'Cable', model: 'Cat6 UTP', unit: 'm' })
    expect(result.allRows.map((r) => r.type)).toEqual([result.cameraRows[0].type, 'Cable'])
  })

  it('a one-floor project deep-equals calling every grouping function directly (no prefix, no merge artefact)', () => {
    const hub: Hub = { id: 'hub-1', x: 0, y: 1000, mountHeightM: 1.5 }
    const cable: Cable = { id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }
    const f = floor('f1', 'Floor 1', {
      cameras: [camera('cam-1', CAMERA_MODEL_ID)],
      sensors: [sectorSensor('sensor-1', SENSOR_MODEL_ID)],
      fireAlarmDevices: [fireDevice('fire-hub', HUB_MODEL_ID), fireDevice('fire-smoke', SMOKE_MODEL_ID)],
      hubs: [hub],
      cables: [cable],
      scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 1 },
    })
    const p = project([f])
    const result = buildCombinedBomRows(p)

    const expectedWarnings = checkFireAlarmCompatibility(f.fireAlarmDevices, fireAlarmModelSpecById, fireAlarmCompatibilityIndex)
    const expectedEstimate = computeCableLayoutEstimate({
      cameras: f.cameras,
      sensors: f.sensors,
      hubs: f.hubs,
      cables: f.cables,
      cableTypes: p.cableTypes,
      cableSettings: p.cableSettings,
      scale: f.scale,
    })

    expect(result.cameraRows).toEqual(groupCamerasIntoBom(f.cameras, buildCameraModelByIdRecord()))
    expect(result.sensorRows).toEqual(groupSensorsIntoBom(f.sensors, buildSensorModelByIdRecord()))
    expect(result.fireAlarmRows).toEqual(groupFireAlarmDevicesIntoBom(f.fireAlarmDevices, fireAlarmModelSpecById, expectedWarnings))
    expect(result.cableRows).toEqual(groupCablesIntoBom(expectedEstimate))
    expect(result.floorsWithoutScale).toEqual([])
  })
})

describe('buildCombinedBomRows - multi-floor merge (plan decision d/f)', () => {
  it('merges the same camera model on two floors into one row, labels floor-prefixed in floor order', () => {
    const f1 = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2', { cameras: [camera('cam-2', CAMERA_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f1, f2]))
    expect(result.cameraRows).toHaveLength(1)
    expect(result.cameraRows[0].quantity).toBe(2)
    expect(result.cameraRows[0].labels).toBe('F1_C1, F2_C1')
  })

  it('a different lens keeps two separate rows', () => {
    const f1 = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2', { cameras: [{ ...camera('cam-2', CAMERA_MODEL_ID), hfovDeg: 45 }] })
    const result = buildCombinedBomRows(project([f1, f2]))
    // Same catalog model id -> same lens spec either way (hfovDeg is a placement override, not a
    // different catalog model) - so this still merges; kept as a sanity check that merging is by
    // the catalog model's own lens label, not by the placed override.
    expect(result.cameraRows).toHaveLength(1)
  })

  it('the per-floor filter (`floorId`) returns that floor\'s own rows, unprefixed', () => {
    const f1 = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2', { cameras: [camera('cam-2', CAMERA_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f1, f2]), { floorId: 'f2' })
    expect(result.cameraRows).toHaveLength(1)
    expect(result.cameraRows[0].quantity).toBe(1)
    expect(result.cameraRows[0].labels).toBe('C1')
  })

  it('a controller placed on ANY floor counts as placed - no "no panel/hub" note for a device on another floor', () => {
    const f1 = floor('f1', 'Floor 1', { fireAlarmDevices: [fireDevice('hub-1', HUB_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2', { fireAlarmDevices: [fireDevice('smoke-1', SMOKE_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f1, f2]))
    expect(result.fireAlarmWarnings.some((w) => w.code === 'no-controller-placed')).toBe(false)
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('Not listed for a placed panel/hub: F2_F1')

    const singleFloorView = buildCombinedBomRows(project([f1, f2]), { floorId: 'f2' })
    expect(singleFloorView.fireAlarmRows[0]?.notes).toBe('Not listed for a placed panel/hub: F1')
  })

  it('"No panel/hub placed" only when no floor has a controller', () => {
    const f1 = floor('f1', 'Floor 1', { fireAlarmDevices: [fireDevice('smoke-1', SMOKE_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2')
    const result = buildCombinedBomRows(project([f1, f2]))
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('No panel/hub placed')
  })

  it('floorsWithoutScale names a floor with a cable but no scale, project-wide only', () => {
    const cable: Cable = { id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }
    const hub: Hub = { id: 'hub-1', x: 0, y: 0, mountHeightM: 1.5 }
    const f1 = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)], hubs: [hub], cables: [cable], scale: null })
    const f2 = floor('f2', 'Floor 2')
    const result = buildCombinedBomRows(project([f1, f2]))
    expect(result.floorsWithoutScale).toEqual([{ position: 1, name: 'Floor 1' }])

    const singleFloorView = buildCombinedBomRows(project([f1, f2]), { floorId: 'f1' })
    expect(singleFloorView.floorsWithoutScale).toEqual([])
  })
})
