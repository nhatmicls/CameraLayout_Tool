import { describe, expect, it } from 'vitest'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor, SensorKind } from '../sensor/sensor-types'
import { computeHiddenCameraIds, computeHiddenSensorIds, NO_HIDDEN_IDS } from './plan-view-visibility'
import { DEFAULT_VIEW_CONFIG, type ViewConfig } from './view-config-types'

const camera = (id: string, modelId: string): PlacedCamera => ({ id, modelId, x: 0, y: 0, rotationDeg: 0, rangeM: 10 })
const CAMERAS = [camera('c1', 'm-dome'), camera('c2', 'm-bullet'), camera('c3', 'm-gone')]
const formFactorOf = (modelId: string) => ({ 'm-dome': 'dome', 'm-bullet': 'bullet' })[modelId]

const SENSORS: PlacedSensor[] = [
  { id: 's1', modelId: 'm-pir', x: 0, y: 0, shape: 'sector', rotationDeg: 0, rangeM: 10 },
  { id: 's2', modelId: 'm-beam', x: 0, y: 0, shape: 'beam', x2: 10, y2: 0, environment: 'indoor' },
  { id: 's3', modelId: 'm-thermal', x: 0, y: 0, shape: 'sector', rotationDeg: 0, rangeM: 50 },
  { id: 's4', modelId: 'm-vibration', x: 0, y: 0, shape: 'circle', radiusM: 3 },
  { id: 's5', modelId: 'm-gone', x: 0, y: 0, shape: 'circle', radiusM: 3 },
]
const sensorKindOf = (modelId: string) =>
  ({ 'm-pir': 'pir', 'm-beam': 'beam', 'm-thermal': 'thermal', 'm-vibration': 'vibration' } as Record<string, SensorKind>)[modelId]

const ids = (set: ReadonlySet<string>) => [...set].sort()

describe('computeHiddenCameraIds', () => {
  it('returns the shared NO_HIDDEN_IDS when everything is visible', () => {
    expect(computeHiddenCameraIds(CAMERAS, DEFAULT_VIEW_CONFIG, formFactorOf)).toBe(NO_HIDDEN_IDS)
  })

  it('ignores sensor / cabling / wall flags', () => {
    const config: ViewConfig = { ...DEFAULT_VIEW_CONFIG, sensorMarkers: false, hubs: false, cables: false, walls: false }
    expect(computeHiddenCameraIds(CAMERAS, config, formFactorOf)).toBe(NO_HIDDEN_IDS)
  })

  it('master markers off hides every known marker and no cone', () => {
    const hidden = computeHiddenCameraIds(CAMERAS, { ...DEFAULT_VIEW_CONFIG, cameraMarkers: false }, formFactorOf)
    expect(ids(hidden.markers)).toEqual(['c1', 'c2'])
    expect(ids(hidden.coverage)).toEqual([])
  })

  it('cones off hides every known cone and no marker', () => {
    const hidden = computeHiddenCameraIds(CAMERAS, { ...DEFAULT_VIEW_CONFIG, cameraCones: false }, formFactorOf)
    expect(ids(hidden.markers)).toEqual([])
    expect(ids(hidden.coverage)).toEqual(['c1', 'c2'])
  })

  it('one form factor off hides both the marker and the cone of those cameras only', () => {
    const config: ViewConfig = { ...DEFAULT_VIEW_CONFIG, cameraFormFactors: { ...DEFAULT_VIEW_CONFIG.cameraFormFactors, dome: false } }
    const hidden = computeHiddenCameraIds(CAMERAS, config, formFactorOf)
    expect(ids(hidden.markers)).toEqual(['c1'])
    expect(ids(hidden.coverage)).toEqual(['c1'])
  })

  it('never hides a camera whose model id is unknown', () => {
    const config: ViewConfig = { ...DEFAULT_VIEW_CONFIG, cameraMarkers: false, cameraCones: false }
    const hidden = computeHiddenCameraIds(CAMERAS, config, formFactorOf)
    expect(hidden.markers.has('c3')).toBe(false)
    expect(hidden.coverage.has('c3')).toBe(false)
  })
})

describe('computeHiddenSensorIds', () => {
  it('returns the shared NO_HIDDEN_IDS when everything is visible', () => {
    expect(computeHiddenSensorIds(SENSORS, DEFAULT_VIEW_CONFIG, sensorKindOf)).toBe(NO_HIDDEN_IDS)
    expect(computeHiddenSensorIds(SENSORS, { ...DEFAULT_VIEW_CONFIG, cameraMarkers: false }, sensorKindOf)).toBe(NO_HIDDEN_IDS)
  })

  it('master markers off hides every known marker, the whole beam included', () => {
    const hidden = computeHiddenSensorIds(SENSORS, { ...DEFAULT_VIEW_CONFIG, sensorMarkers: false }, sensorKindOf)
    expect(ids(hidden.markers)).toEqual(['s1', 's2', 's3', 's4'])
    expect(ids(hidden.coverage)).toEqual([])
  })

  it('coverage off hides PIR, thermal and vibration coverage, and never lists a beam', () => {
    const hidden = computeHiddenSensorIds(SENSORS, { ...DEFAULT_VIEW_CONFIG, sensorCoverage: false }, sensorKindOf)
    expect(ids(hidden.markers)).toEqual([])
    expect(ids(hidden.coverage)).toEqual(['s1', 's3', 's4'])
  })

  it('kind "beam" off hides the beam as a marker only', () => {
    const config: ViewConfig = { ...DEFAULT_VIEW_CONFIG, sensorKinds: { ...DEFAULT_VIEW_CONFIG.sensorKinds, beam: false } }
    const hidden = computeHiddenSensorIds(SENSORS, config, sensorKindOf)
    expect(ids(hidden.markers)).toEqual(['s2'])
    expect(ids(hidden.coverage)).toEqual([])
  })

  it('kind "thermal" off hides the thermal marker and its cone', () => {
    const config: ViewConfig = { ...DEFAULT_VIEW_CONFIG, sensorKinds: { ...DEFAULT_VIEW_CONFIG.sensorKinds, thermal: false } }
    const hidden = computeHiddenSensorIds(SENSORS, config, sensorKindOf)
    expect(ids(hidden.markers)).toEqual(['s3'])
    expect(ids(hidden.coverage)).toEqual(['s3'])
  })

  it('never hides a sensor whose model id is unknown', () => {
    const config: ViewConfig = { ...DEFAULT_VIEW_CONFIG, sensorMarkers: false, sensorCoverage: false }
    const hidden = computeHiddenSensorIds(SENSORS, config, sensorKindOf)
    expect(hidden.markers.has('s5')).toBe(false)
    expect(hidden.coverage.has('s5')).toBe(false)
  })
})
