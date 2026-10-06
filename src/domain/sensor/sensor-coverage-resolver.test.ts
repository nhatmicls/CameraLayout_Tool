import { describe, expect, it } from 'vitest'
import { resolveBeamMaxDistanceM, resolveSensorAreaCoverage } from './sensor-coverage-resolver'
import type {
  BeamModelSpec,
  PlacedCircleSensor,
  PlacedSectorSensor,
  SensorModelSpec,
} from './sensor-types'

const pirSpec: SensorModelSpec = { brand: 'hikvision', model: 'p1', kind: 'pir', coverage: { rangeM: 12, angleDeg: 90 } }
const thermalSpec: SensorModelSpec = {
  brand: 'dahua',
  model: 't1',
  kind: 'thermal',
  pixelWidth: 384,
  pixelHeight: 288,
  focalMm: 7,
  hfovDeg: 45,
  detectionRangeM: { human: { detect: 300, recognize: 150, identify: 50 }, vehicle: null },
}
const vibrationSpec: SensorModelSpec = {
  brand: 'bosch',
  model: 'v1',
  kind: 'vibration',
  detection: 'shock',
  radii: [
    { surface: 'glass', radiusM: 6 },
    { surface: 'wood', radiusM: 9 },
  ],
}
const beamSpec: SensorModelSpec = { brand: 'takex', model: 'b1', kind: 'beam', maxDistanceOutdoorM: 100, maxDistanceIndoorM: 150 }

function sector(overrides: Partial<PlacedSectorSensor> = {}): PlacedSectorSensor {
  return { id: 's1', modelId: 'm', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 12, ...overrides }
}

function circle(overrides: Partial<PlacedCircleSensor> = {}): PlacedCircleSensor {
  return { id: 'c1', modelId: 'm', shape: 'circle', x: 0, y: 0, radiusM: 6, ...overrides }
}

describe('resolveSensorAreaCoverage - pir', () => {
  it('clamps a stored range above the datasheet range', () => {
    const result = resolveSensorAreaCoverage(pirSpec, sector({ rangeM: 999 }))
    expect(result?.maxRangeM).toBe(12)
    expect(result?.bands).toEqual([{ key: 'coverage', innerM: 0, outerM: 12 }])
  })

  it('keeps a stored range at or below the datasheet range', () => {
    expect(resolveSensorAreaCoverage(pirSpec, sector({ rangeM: 5 }))?.maxRangeM).toBe(5)
  })

  it('clamps an angle override above the printed angle', () => {
    expect(resolveSensorAreaCoverage(pirSpec, sector({ angleDeg: 150 }))?.angleDeg).toBe(90)
  })

  it('keeps an angle override below the printed angle', () => {
    expect(resolveSensorAreaCoverage(pirSpec, sector({ angleDeg: 30 }))?.angleDeg).toBe(30)
  })

  it('uses the printed angle when there is no override', () => {
    expect(resolveSensorAreaCoverage(pirSpec, sector())?.angleDeg).toBe(90)
  })

  // A 360deg ceiling PIR's effective angle must drop below 360 once the
  // user overrides it down - the panel's rotation input and the canvas rotation handle both
  // key off this EFFECTIVE value (`coverage.angleDeg < 360`), not the printed one.
  it('drops below 360 when a 360deg ceiling PIR has its angle overridden down (L1)', () => {
    const ceilingPirSpec: SensorModelSpec = { brand: 'hikvision', model: 'p-ceiling', kind: 'pir', coverage: { rangeM: 8, angleDeg: 360 } }
    expect(resolveSensorAreaCoverage(ceilingPirSpec, sector())?.angleDeg).toBe(360)
    expect(resolveSensorAreaCoverage(ceilingPirSpec, sector({ angleDeg: 180 }))?.angleDeg).toBe(180)
  })
})

describe('resolveSensorAreaCoverage - thermal', () => {
  it('clamps range to the human detect distance and ignores any angle override', () => {
    const result = resolveSensorAreaCoverage(thermalSpec, sector({ rangeM: 1000, angleDeg: 10 }))
    expect(result?.maxRangeM).toBe(300)
    expect(result?.angleDeg).toBe(45) // printed HFOV, never overridden
  })

  it('produces D/R/I bands via the shared thermal band calculator', () => {
    const result = resolveSensorAreaCoverage(thermalSpec, sector({ rangeM: 300 }))
    expect(result?.bands).toEqual([
      { key: 'identify', innerM: 0, outerM: 50 },
      { key: 'recognize', innerM: 50, outerM: 150 },
      { key: 'detect', innerM: 150, outerM: 300 },
    ])
  })
})

describe('resolveSensorAreaCoverage - vibration', () => {
  it('returns a full circle (angleDeg 360) clamped to the largest printed radius', () => {
    const result = resolveSensorAreaCoverage(vibrationSpec, circle({ radiusM: 999 }))
    expect(result?.angleDeg).toBe(360)
    expect(result?.maxRangeM).toBe(9)
  })

  it('keeps a radius at or below the largest printed radius', () => {
    expect(resolveSensorAreaCoverage(vibrationSpec, circle({ radiusM: 3 }))?.maxRangeM).toBe(3)
  })
})

describe('resolveSensorAreaCoverage - shape/kind mismatch', () => {
  it('returns null when the model kind does not match the placed shape', () => {
    expect(resolveSensorAreaCoverage(pirSpec, circle())).toBeNull()
    expect(resolveSensorAreaCoverage(vibrationSpec, sector())).toBeNull()
    expect(resolveSensorAreaCoverage(beamSpec, sector())).toBeNull()
    expect(resolveSensorAreaCoverage(beamSpec, circle())).toBeNull()
  })
})

describe('resolveBeamMaxDistanceM', () => {
  it('uses the outdoor figure when both are printed and environment is outdoor', () => {
    expect(resolveBeamMaxDistanceM(beamSpec as BeamModelSpec, 'outdoor')).toEqual({
      limitM: 100,
      outdoorM: 100,
      indoorM: 150,
    })
  })

  it('flips to the indoor figure when environment is indoor', () => {
    expect(resolveBeamMaxDistanceM(beamSpec as BeamModelSpec, 'indoor')).toEqual({
      limitM: 150,
      outdoorM: 100,
      indoorM: 150,
    })
  })

  it('falls back to the other figure when the chosen one is not printed', () => {
    const outdoorOnly: BeamModelSpec = { brand: 'takex', model: 'b2', kind: 'beam', maxDistanceOutdoorM: 80, maxDistanceIndoorM: null }
    expect(resolveBeamMaxDistanceM(outdoorOnly, 'indoor').limitM).toBe(80)

    const indoorOnly: BeamModelSpec = { brand: 'takex', model: 'b3', kind: 'beam', maxDistanceOutdoorM: null, maxDistanceIndoorM: 60 }
    expect(resolveBeamMaxDistanceM(indoorOnly, 'outdoor').limitM).toBe(60)
  })
})
