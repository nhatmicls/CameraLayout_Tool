import { describe, expect, it } from 'vitest'
import { buildCombinedBomRows } from './build-combined-bom-rows'
import { groupCamerasIntoBom, type BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { groupCablesIntoBom } from '../../domain/bom/cable-bill-of-materials-grouping'
import { groupFireAlarmDevicesIntoBom, prefixFireAlarmNoteLabels } from '../../domain/bom/fire-alarm-bill-of-materials-grouping'
import { groupSensorsIntoBom } from '../../domain/bom/sensor-bill-of-materials-grouping'
import { computeCableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import { createDefaultCableTypes, DEFAULT_CABLE_SETTINGS, type Cable, type Hub } from '../../domain/cable/cable-layout-types'
import { checkFireAlarmCompatibility } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { DEFAULT_FIRE_ALARM_SETTINGS, type PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
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
const HEAT_MODEL_ID = 'hikvision-ds-pdht-e-we' // designator "H" - shares the shared "H" counter with a plain hub marker

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

/** `'C1, C3'` -> `'F1_C1, F1_C3'` - mirrors what `mergeBomRowsAcrossFloors` applies to every row's `labels`, for comparing a direct grouper call against `buildCombinedBomRows`'s always-prefixed output (owner decision 2026-10-09). */
function prefixRowLabels(rows: BomRow[], prefix: string): BomRow[] {
  return rows.map((row) => ({
    ...row,
    labels: row.labels
      .split(', ')
      .map((label) => `${prefix}${label}`)
      .join(', '),
    ...(row.notes === undefined ? {} : { notes: prefixFireAlarmNoteLabels(row.notes, prefix) }),
  }))
}

describe('buildCombinedBomRows - single floor (labels always floor-prefixed, owner decision 2026-10-09)', () => {
  it('returns no rows and no warnings for an empty project', () => {
    const result = buildCombinedBomRows(project([floor('f1', 'Floor 1')]))
    expect(result.allRows).toEqual([])
    expect(result.fireAlarmWarnings).toEqual([])
  })

  it('no hubs -> no cabling-point row and no note part, output otherwise identical to before (apart from the always-on floor prefix)', () => {
    const f = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f]))
    expect(result.cablingPointRows).toEqual([])
    expect(result.allRows).toEqual(result.cameraRows)
  })

  it('a hub row\'s label comes from the shared allocator: a heat detector (designator "H") placed first makes the plain hub "H2", not "H1"', () => {
    const f = floor('f1', 'Floor 1', {
      fireAlarmDevices: [fireDevice('heat-1', HEAT_MODEL_ID)],
      hubs: [{ id: 'hub-1', x: 0, y: 0, mountHeightM: 1.5 }],
    })
    const result = buildCombinedBomRows(project([f]))
    const heatRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDHT-E-WE')
    expect(heatRow?.labels).toBe('F1_H1')
    expect(result.cablingPointRows).toEqual([expect.objectContaining({ type: 'Cable hub', labels: 'F1_H2' })])
  })

  it('orders allRows as cameras, then sensors, then fire-alarm devices, then cabling points, then cables (no scale = no cable rows)', () => {
    const f = floor('f1', 'Floor 1', {
      cameras: [camera('cam-1', CAMERA_MODEL_ID)],
      sensors: [sectorSensor('sensor-1', SENSOR_MODEL_ID)],
      fireAlarmDevices: [fireDevice('fire-1', SMOKE_MODEL_ID)],
      hubs: [{ id: 'hub-1', x: 0, y: 0, mountHeightM: 1.5 }],
    })
    const result = buildCombinedBomRows(project([f]))
    expect(result.allRows.map((r) => r.type)).toEqual([result.cameraRows[0].type, result.sensorRows[0].type, result.fireAlarmRows[0].type, 'Cable hub'])
    expect(result.allRows).toHaveLength(4)
  })

  it('flags a detector not listed for the one placed hub, and reuses that warning for the row note - label floor-prefixed even on one floor', () => {
    const f = floor('f1', 'Floor 1', { fireAlarmDevices: [fireDevice('fire-hub', HUB_MODEL_ID), fireDevice('fire-smoke', SMOKE_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f]))
    expect(result.fireAlarmWarnings).toEqual([{ code: 'not-listed-for-placed-controllers', deviceId: 'fire-smoke', modelId: SMOKE_MODEL_ID }])
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('Not listed for a placed panel/hub: F1_S1')
  })

  it('has no fire-alarm rows or warnings without any fire-alarm devices', () => {
    const f = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f]))
    expect(result.fireAlarmRows).toEqual([])
    expect(result.fireAlarmWarnings).toEqual([])
  })

  it('cable rows come from the project cable estimate (labels already both-floor-prefixed by the cable end-to-end label, one floor included)', () => {
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
    // The one hub in this fixture also produces a "Cable hub" cabling-point row, between the
    // fire-alarm rows (none here) and the cable rows.
    expect(result.allRows.map((r) => r.type)).toEqual([result.cameraRows[0].type, 'Cable hub', 'Cable'])
  })

  it('a one-floor project deep-equals calling every grouping function directly, once its labels/notes are prefixed the same way the merge would (owner decision 2026-10-09)', () => {
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
    // Same allocator call `buildCombinedBomRows` itself makes - the groupers take labels, they no
    // longer number anything themselves.
    const expectedLabels = buildFloorItemLabels(f, { shaftIds: [], fireAlarmModelById: fireAlarmModelSpecById })

    expect(result.cameraRows).toEqual(prefixRowLabels(groupCamerasIntoBom(f.cameras, buildCameraModelByIdRecord(), expectedLabels.cameras), 'F1_'))
    expect(result.sensorRows).toEqual(prefixRowLabels(groupSensorsIntoBom(f.sensors, buildSensorModelByIdRecord(), expectedLabels.sensors), 'F1_'))
    expect(result.fireAlarmRows).toEqual(
      prefixRowLabels(groupFireAlarmDevicesIntoBom(f.fireAlarmDevices, fireAlarmModelSpecById, expectedLabels.fireAlarmDevices, expectedWarnings), 'F1_'),
    )
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

  it('the per-floor filter (`floorId`) returns that floor\'s own rows, still floor-prefixed (owner decision 2026-10-09)', () => {
    const f1 = floor('f1', 'Floor 1', { cameras: [camera('cam-1', CAMERA_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2', { cameras: [camera('cam-2', CAMERA_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f1, f2]), { floorId: 'f2' })
    expect(result.cameraRows).toHaveLength(1)
    expect(result.cameraRows[0].quantity).toBe(1)
    expect(result.cameraRows[0].labels).toBe('F2_C1')
  })

  it('a controller placed on ANY floor counts as placed - no "no panel/hub" note for a device on another floor', () => {
    const f1 = floor('f1', 'Floor 1', { fireAlarmDevices: [fireDevice('hub-1', HUB_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2', { fireAlarmDevices: [fireDevice('smoke-1', SMOKE_MODEL_ID)] })
    const result = buildCombinedBomRows(project([f1, f2]))
    expect(result.fireAlarmWarnings.some((w) => w.code === 'no-controller-placed')).toBe(false)
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('Not listed for a placed panel/hub: F2_S1')

    const singleFloorView = buildCombinedBomRows(project([f1, f2]), { floorId: 'f2' })
    expect(singleFloorView.fireAlarmRows[0]?.notes).toBe('Not listed for a placed panel/hub: F2_S1')
  })

  it('"No panel/hub placed" only when no floor has a controller', () => {
    const f1 = floor('f1', 'Floor 1', { fireAlarmDevices: [fireDevice('smoke-1', SMOKE_MODEL_ID)] })
    const f2 = floor('f2', 'Floor 2')
    const result = buildCombinedBomRows(project([f1, f2]))
    const smokeRow = result.fireAlarmRows.find((r) => r.model === 'DS-PDSMK-S-WE')
    expect(smokeRow?.notes).toBe('No panel/hub placed')
  })

  it('a cable row\'s label is identical whether read project-wide or through the per-floor filter', () => {
    const hub: Hub = { id: 'hub-1', x: 0, y: 1000, mountHeightM: 1.5 }
    const cable: Cable = { id: 'cable-1', device: { kind: 'camera', id: 'cam-1' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }
    const f1 = floor('f1', 'Floor 1', {
      cameras: [camera('cam-1', CAMERA_MODEL_ID)],
      hubs: [hub],
      cables: [cable],
      scale: { planPxPerMeter: 100, refLine: { x1: 0, y1: 0, x2: 100, y2: 0 }, refLengthM: 1 },
    })
    const f2 = floor('f2', 'Floor 2')
    const p = project([f1, f2])
    const projectWide = buildCombinedBomRows(p)
    const perFloor = buildCombinedBomRows(p, { floorId: 'f1' })
    expect(projectWide.cableRows[0].labels).toBe('F1_C1_F1_H1')
    expect(perFloor.cableRows[0].labels).toBe('F1_C1_F1_H1') // both ends already carry their floor - unprefixed per-floor view reads the same string
    expect(projectWide.cableRows[0].labels).toBe(perFloor.cableRows[0].labels)
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

  it('cabling-point rows: 2 hubs + 1 riser + 1 drop + a shaft opening on all 3 floors -> four rows, quantities 2/1/1/3, labels floor-prefixed, fixed order, between fire-alarm and cable rows', () => {
    const f1 = floor('f1', 'Floor 1', {
      hubs: [
        { id: 'hub-a', x: 0, y: 0, mountHeightM: 1.5 },
        { id: 'hub-b', x: 10, y: 0, mountHeightM: 1.5 },
        { id: 'shaft-a', kind: 'shaft', shaftId: 'shaft-1', x: 20, y: 0, mountHeightM: 0 },
      ],
    })
    const f2 = floor('f2', 'Floor 2', {
      hubs: [
        { id: 'riser-a', kind: 'riser', x: 0, y: 0, mountHeightM: 3 },
        { id: 'shaft-b', kind: 'shaft', shaftId: 'shaft-1', x: 20, y: 0, mountHeightM: 0 },
      ],
    })
    const f3 = floor('f3', 'Floor 3', {
      hubs: [
        { id: 'drop-a', kind: 'drop', x: 0, y: 0, mountHeightM: 3 },
        { id: 'shaft-c', kind: 'shaft', shaftId: 'shaft-1', x: 20, y: 0, mountHeightM: 0 },
      ],
    })
    const result = buildCombinedBomRows(project([f1, f2, f3], { shafts: [{ id: 'shaft-1', name: 'Main shaft' }] }))

    expect(result.cablingPointRows.map((r) => r.type)).toEqual(['Cable hub', 'Riser', 'Drop', 'Shaft opening'])
    expect(result.cablingPointRows.map((r) => r.quantity)).toEqual([2, 1, 1, 3])
    expect(result.cablingPointRows.map((r) => r.labels)).toEqual(['F1_H1, F1_H2', 'F2_R1', 'F3_D1', 'F1_T1, F2_T1, F3_T1'])
    expect(result.cablingPointRows.every((r) => r.priceTbd === true)).toBe(true)
    expect(result.cablingPointRows.every((r) => r.unitPriceVnd === null && r.lineTotalVnd === null)).toBe(true)

    // No cameras/sensors/fire-alarm devices/cables in this fixture - allRows is exactly the
    // cabling-point rows, which already proves they sit between fire-alarm and cable rows
    // (both empty here) in `build-combined-bom-rows.ts`'s fixed `allRows` order.
    expect(result.cameraRows).toEqual([])
    expect(result.fireAlarmRows).toEqual([])
    expect(result.cableRows).toEqual([])
    expect(result.allRows).toEqual(result.cablingPointRows)
  })
})
