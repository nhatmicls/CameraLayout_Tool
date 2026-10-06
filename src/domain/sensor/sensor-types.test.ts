import { describe, expect, it } from 'vitest'
import { defaultBeamEnvironment, printedVfovDeg, sensorPlacementShape, type BeamModelSpec, type SensorModelSpec } from './sensor-types'

const pirSpec: SensorModelSpec = {
  brand: 'hikvision',
  model: 'DS-PD1',
  kind: 'pir',
  coverage: { rangeM: 12, angleDeg: 90 },
}

const thermalSpec: SensorModelSpec = {
  brand: 'dahua',
  model: 'TPC-BF5401',
  kind: 'thermal',
  pixelWidth: 384,
  pixelHeight: 288,
  focalMm: 7,
  hfovDeg: 45,
  detectionRangeM: { human: { detect: 300, recognize: 150, identify: 75 }, vehicle: null },
}

const vibrationSpec: SensorModelSpec = {
  brand: 'bosch',
  model: 'DS160',
  kind: 'vibration',
  detection: 'shock',
  radii: [{ surface: null, radiusM: 6 }],
}

const beamSpec: SensorModelSpec = {
  brand: 'takex',
  model: 'PB-100',
  kind: 'beam',
  maxDistanceOutdoorM: 100,
  maxDistanceIndoorM: 150,
}

describe('printedVfovDeg', () => {
  it('reads coverage.vfovDeg for pir', () => {
    const withVfov: SensorModelSpec = { brand: 'hikvision', model: 'p1', kind: 'pir', coverage: { rangeM: 12, angleDeg: 90, vfovDeg: 45 } }
    expect(printedVfovDeg(withVfov)).toBe(45)
  })

  it('reads vfovDeg for thermal', () => {
    const withVfov: SensorModelSpec = {
      brand: 'dahua',
      model: 't1',
      kind: 'thermal',
      pixelWidth: 384,
      pixelHeight: 288,
      focalMm: 7,
      hfovDeg: 45,
      vfovDeg: 33,
      detectionRangeM: { human: { detect: 300, recognize: 150, identify: 50 }, vehicle: null },
    }
    expect(printedVfovDeg(withVfov)).toBe(33)
  })

  it('is undefined when not printed, and for vibration/beam', () => {
    expect(printedVfovDeg(pirSpec)).toBeUndefined()
    expect(printedVfovDeg(vibrationSpec)).toBeUndefined()
    expect(printedVfovDeg(beamSpec)).toBeUndefined()
  })
})

describe('sensorPlacementShape', () => {
  it('maps pir and thermal to sector, vibration to circle, beam to beam', () => {
    expect(sensorPlacementShape(pirSpec)).toBe('sector')
    expect(sensorPlacementShape(thermalSpec)).toBe('sector')
    expect(sensorPlacementShape(vibrationSpec)).toBe('circle')
    expect(sensorPlacementShape(beamSpec)).toBe('beam')
  })
})

describe('defaultBeamEnvironment', () => {
  it('picks the environment with the smaller printed max distance', () => {
    const spec: BeamModelSpec = { brand: 'takex', model: 'x', kind: 'beam', maxDistanceOutdoorM: 100, maxDistanceIndoorM: 60 }
    expect(defaultBeamEnvironment(spec)).toBe('indoor')
  })

  it('picks outdoor when the two figures are equal', () => {
    const spec: BeamModelSpec = { brand: 'takex', model: 'x', kind: 'beam', maxDistanceOutdoorM: 50, maxDistanceIndoorM: 60 }
    expect(defaultBeamEnvironment(spec)).toBe('outdoor')
  })

  it('picks the only printed figure when the other is null', () => {
    const outdoorOnly: BeamModelSpec = { brand: 'takex', model: 'x', kind: 'beam', maxDistanceOutdoorM: 80, maxDistanceIndoorM: null }
    expect(defaultBeamEnvironment(outdoorOnly)).toBe('outdoor')

    const indoorOnly: BeamModelSpec = { brand: 'takex', model: 'x', kind: 'beam', maxDistanceOutdoorM: null, maxDistanceIndoorM: 80 }
    expect(defaultBeamEnvironment(indoorOnly)).toBe('indoor')
  })
})

// `applyPlacedSensorPatch` tests live in `placed-sensor-patch.test.ts`, next to the
// implementation (moved out of this file to keep it under the line-count guideline).
