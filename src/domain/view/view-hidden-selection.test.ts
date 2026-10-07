import { describe, expect, it } from 'vitest'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor, SensorKind } from '../sensor/sensor-types'
import { DEFAULT_VIEW_CONFIG, type ViewConfig } from './view-config-types'
import { isSelectionHiddenByView, type ViewHideableSelection } from './view-hidden-selection'

const NONE: ViewHideableSelection = {
  selectedCameraId: null,
  selectedSensorId: null,
  selectedHubId: null,
  selectedCableId: null,
  selectedWallId: null,
}
const CAMERAS: PlacedCamera[] = [
  { id: 'c1', modelId: 'm-dome', x: 0, y: 0, rotationDeg: 0, rangeM: 10 },
  { id: 'c2', modelId: 'm-gone', x: 0, y: 0, rotationDeg: 0, rangeM: 10 },
]
const SENSORS: PlacedSensor[] = [
  { id: 's1', modelId: 'm-beam', x: 0, y: 0, shape: 'beam', x2: 10, y2: 0, environment: 'indoor' },
  { id: 's2', modelId: 'm-thermal', x: 0, y: 0, shape: 'sector', rotationDeg: 0, rangeM: 50 },
]
const formFactorOf = (modelId: string) => ({ 'm-dome': 'dome' })[modelId]
const sensorKindOf = (modelId: string) => ({ 'm-beam': 'beam', 'm-thermal': 'thermal' } as Record<string, SensorKind>)[modelId]

const hidden = (selection: Partial<ViewHideableSelection>, view: Partial<ViewConfig>) =>
  isSelectionHiddenByView({ ...NONE, ...selection }, { ...DEFAULT_VIEW_CONFIG, ...view }, CAMERAS, SENSORS, formFactorOf, sensorKindOf)

describe('isSelectionHiddenByView', () => {
  it('is false with nothing selected, whatever is hidden', () => {
    expect(hidden({}, { cameraMarkers: false, sensorMarkers: false, hubs: false, cables: false, walls: false })).toBe(false)
  })

  it('is false for every selection kind when everything is visible', () => {
    for (const key of Object.keys(NONE) as (keyof ViewHideableSelection)[]) {
      expect(hidden({ [key]: key === 'selectedSensorId' ? 's1' : 'c1' }, {})).toBe(false)
    }
  })

  it('follows the plain flag for a hub, a cable and a wall', () => {
    expect(hidden({ selectedHubId: 'h1' }, { hubs: false })).toBe(true)
    expect(hidden({ selectedHubId: 'h1' }, { cables: false, walls: false })).toBe(false)
    expect(hidden({ selectedCableId: 'k1' }, { cables: false })).toBe(true)
    expect(hidden({ selectedCableId: 'k1' }, { hubs: false })).toBe(false)
    expect(hidden({ selectedWallId: 'w1' }, { walls: false })).toBe(true)
  })

  it('a camera is hidden by the master markers flag or by its form factor, not by the cones flag', () => {
    expect(hidden({ selectedCameraId: 'c1' }, { cameraMarkers: false })).toBe(true)
    expect(hidden({ selectedCameraId: 'c1' }, { cameraFormFactors: { ...DEFAULT_VIEW_CONFIG.cameraFormFactors, dome: false } })).toBe(true)
    expect(hidden({ selectedCameraId: 'c1' }, { cameraFormFactors: { ...DEFAULT_VIEW_CONFIG.cameraFormFactors, bullet: false } })).toBe(false)
    expect(hidden({ selectedCameraId: 'c1' }, { cameraCones: false })).toBe(false)
  })

  it('a sensor is hidden by the master markers flag or by its kind, not by the coverage flag', () => {
    expect(hidden({ selectedSensorId: 's1' }, { sensorMarkers: false })).toBe(true)
    expect(hidden({ selectedSensorId: 's1' }, { sensorKinds: { ...DEFAULT_VIEW_CONFIG.sensorKinds, beam: false } })).toBe(true)
    expect(hidden({ selectedSensorId: 's2' }, { sensorKinds: { ...DEFAULT_VIEW_CONFIG.sensorKinds, beam: false } })).toBe(false)
    expect(hidden({ selectedSensorId: 's2' }, { sensorCoverage: false })).toBe(false)
  })

  it('never reports an unknown model or a missing id as hidden', () => {
    expect(hidden({ selectedCameraId: 'c2' }, { cameraMarkers: false })).toBe(false)
    expect(hidden({ selectedCameraId: 'nope' }, { cameraMarkers: false })).toBe(false)
    expect(hidden({ selectedSensorId: 'nope' }, { sensorMarkers: false })).toBe(false)
  })
})
