import { describe, expect, it } from 'vitest'
import type { PlacedCamera } from '../project-file/project-types'
import type { PlacedSensor, SensorKind } from '../sensor/sensor-types'
import { countPlanItemsForView, viewToggleItemCount } from './plan-view-item-counts'

const camera = (id: string, modelId: string): PlacedCamera => ({ id, modelId, x: 0, y: 0, rotationDeg: 0, rangeM: 10 })
const formFactorOf = (modelId: string) => ({ 'm-dome': 'dome', 'm-ptz': 'ptz' })[modelId]
const sensorKindOf = (modelId: string) => ({ 'm-pir': 'pir', 'm-beam': 'beam' } as Record<string, SensorKind>)[modelId]

const SENSORS: PlacedSensor[] = [
  { id: 's1', modelId: 'm-pir', x: 0, y: 0, shape: 'sector', rotationDeg: 0, rangeM: 10 },
  { id: 's2', modelId: 'm-beam', x: 0, y: 0, shape: 'beam', x2: 10, y2: 0, environment: 'indoor' },
  { id: 's3', modelId: 'm-gone', x: 0, y: 0, shape: 'circle', radiusM: 3 },
]

const MIXED = countPlanItemsForView(
  {
    cameras: [camera('c1', 'm-dome'), camera('c2', 'm-dome'), camera('c3', 'm-ptz'), camera('c4', 'm-gone')],
    sensors: SENSORS,
    hubs: [{ kind: 'hub' }, { kind: 'riser' }, { kind: 'drop' }],
    cables: [{}, {}],
    walls: [{}],
  },
  formFactorOf,
  sensorKindOf,
)

describe('countPlanItemsForView', () => {
  it('counts a mixed project; an unknown model id counts in the total only', () => {
    expect(MIXED).toEqual({
      cameras: 4,
      cameraFormFactors: { bullet: 0, dome: 2, turret: 0, ptz: 1, fisheye: 0 },
      sensors: 3,
      sensorKinds: { pir: 1, beam: 1, vibration: 0, thermal: 0 },
      hubs: 3,
      cables: 2,
      walls: 1,
    })
  })

  it('is all zero for an empty project', () => {
    const counts = countPlanItemsForView({ cameras: [], sensors: [], hubs: [], cables: [], walls: [] }, formFactorOf, sensorKindOf)
    expect(counts.cameras + counts.sensors + counts.hubs + counts.cables + counts.walls).toBe(0)
    expect(Object.values(counts.cameraFormFactors).every((n) => n === 0)).toBe(true)
    expect(Object.values(counts.sensorKinds).every((n) => n === 0)).toBe(true)
  })
})

describe('viewToggleItemCount', () => {
  it('gives a master row its group total and a sub-row its own count', () => {
    expect(viewToggleItemCount(MIXED, { flag: 'cameraMarkers' })).toBe(4)
    expect(viewToggleItemCount(MIXED, { flag: 'cameraCones' })).toBe(4)
    expect(viewToggleItemCount(MIXED, { formFactor: 'dome' })).toBe(2)
    expect(viewToggleItemCount(MIXED, { formFactor: 'bullet' })).toBe(0)
    expect(viewToggleItemCount(MIXED, { flag: 'sensorMarkers' })).toBe(3)
    expect(viewToggleItemCount(MIXED, { flag: 'sensorCoverage' })).toBe(3)
    expect(viewToggleItemCount(MIXED, { sensorKind: 'beam' })).toBe(1)
    expect(viewToggleItemCount(MIXED, { flag: 'hubs' })).toBe(3)
    expect(viewToggleItemCount(MIXED, { flag: 'cables' })).toBe(2)
    expect(viewToggleItemCount(MIXED, { flag: 'walls' })).toBe(1)
  })
})
