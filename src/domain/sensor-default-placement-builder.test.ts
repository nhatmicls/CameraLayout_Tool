import { describe, expect, it } from 'vitest'
import { BEAM_DEFAULT_LENGTH_M, THERMAL_DEFAULT_MAX_RANGE_M, buildPlacedSensorAtDrop } from './sensor-default-placement-builder'
import type { SensorModelSpec } from './sensor-types'

const pirSpec: SensorModelSpec = { brand: 'hikvision', model: 'p1', kind: 'pir', coverage: { rangeM: 12, angleDeg: 90 } }
const thermalSpecFarDetect: SensorModelSpec = {
  brand: 'dahua',
  model: 't1',
  kind: 'thermal',
  pixelWidth: 384,
  pixelHeight: 288,
  focalMm: 7,
  hfovDeg: 45,
  detectionRangeM: { human: { detect: 300, recognize: 150, identify: 50 }, vehicle: null },
}
const thermalSpecNearDetect: SensorModelSpec = {
  ...thermalSpecFarDetect,
  detectionRangeM: { human: { detect: 50, recognize: 25, identify: 10 }, vehicle: null },
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
const beamSpecShortLimit: SensorModelSpec = { brand: 'takex', model: 'b1', kind: 'beam', maxDistanceOutdoorM: 3, maxDistanceIndoorM: null }
const beamSpecLongLimit: SensorModelSpec = { brand: 'takex', model: 'b2', kind: 'beam', maxDistanceOutdoorM: 100, maxDistanceIndoorM: null }

const BASE = { id: 's1', modelId: 'm1', x: 100, y: 50, planPxPerMeter: 10, imageWidthPx: 1000, imageHeightPx: 800 }

describe('buildPlacedSensorAtDrop - pir', () => {
  it('uses the printed range and rotationDeg 0', () => {
    const sensor = buildPlacedSensorAtDrop({ ...BASE, spec: pirSpec })
    expect(sensor).toMatchObject({ shape: 'sector', rotationDeg: 0, rangeM: 12, x: 100, y: 50 })
  })
})

describe('buildPlacedSensorAtDrop - thermal', () => {
  it('caps the default range at THERMAL_DEFAULT_MAX_RANGE_M when the detect distance is larger', () => {
    const sensor = buildPlacedSensorAtDrop({ ...BASE, spec: thermalSpecFarDetect })
    expect(sensor).toMatchObject({ shape: 'sector', rangeM: THERMAL_DEFAULT_MAX_RANGE_M })
  })

  it('uses the detect distance itself when it is below the cap', () => {
    const sensor = buildPlacedSensorAtDrop({ ...BASE, spec: thermalSpecNearDetect })
    expect(sensor).toMatchObject({ shape: 'sector', rangeM: 50 })
  })
})

describe('buildPlacedSensorAtDrop - vibration', () => {
  it('uses the first printed radius row', () => {
    const sensor = buildPlacedSensorAtDrop({ ...BASE, spec: vibrationSpec })
    expect(sensor).toMatchObject({ shape: 'circle', radiusM: 6 })
  })
})

describe('buildPlacedSensorAtDrop - beam', () => {
  it('defaults to BEAM_DEFAULT_LENGTH_M along +x when the model limit allows it and the image has room', () => {
    const sensor = buildPlacedSensorAtDrop({ ...BASE, spec: beamSpecLongLimit })
    expect(sensor).toMatchObject({
      shape: 'beam',
      x: 100,
      y: 50,
      x2: 100 + BEAM_DEFAULT_LENGTH_M * BASE.planPxPerMeter,
      y2: 50,
      environment: 'outdoor',
    })
  })

  it('never exceeds the model limit even when shorter than BEAM_DEFAULT_LENGTH_M', () => {
    const sensor = buildPlacedSensorAtDrop({ ...BASE, spec: beamSpecShortLimit })
    expect(sensor).toMatchObject({ shape: 'beam', x2: 100 + beamSpecShortLimit.maxDistanceOutdoorM! * BASE.planPxPerMeter })
  })

  it('flips to -x when +x would leave the image, then stays in bounds', () => {
    const nearRightEdge = { ...BASE, x: 980 }
    const sensor = buildPlacedSensorAtDrop({ ...nearRightEdge, spec: beamSpecLongLimit })
    // +x would land at 980 + 50 = 1030, past imageWidthPx (1000) -> flips to 980 - 50 = 930.
    expect(sensor).toMatchObject({ shape: 'beam', x: 980, x2: 930 })
  })

  it('picks the side with equal-or-more room when neither side fully fits (room tied: prefers +x)', () => {
    const tinyImage = { ...BASE, x: 10, imageWidthPx: 20 }
    const sensor = buildPlacedSensorAtDrop({ ...tinyImage, spec: beamSpecLongLimit })
    // Room is 10px either way (x=10 in a 20px-wide image); lengthPx (50) exceeds both, so
    // the tie goes to +x, clamped into [0, 20] -> x2 = 20 (the resulting length, 10, is
    // identical whichever direction is picked here).
    expect(sensor).toMatchObject({ shape: 'beam', x2: 20 })
  })

  // A plan narrower than the default beam length must never flip to -x unconditionally when
  // +x doesn't fully fit - that would collapse to a zero-length beam whenever the drop point
  // is ALSO near the left edge (x - lengthPx clamps to 0, equal to x itself).
  it('never produces a zero-length beam when the plan is narrower than the default length and x is near the left edge', () => {
    const narrowImageNearLeftEdge = { ...BASE, x: 0, imageWidthPx: 5 }
    const sensor = buildPlacedSensorAtDrop({ ...narrowImageNearLeftEdge, spec: beamSpecLongLimit })
    if (sensor.shape !== 'beam') throw new Error('expected a beam sensor')
    expect(Math.hypot(sensor.x2 - sensor.x, sensor.y2 - sensor.y)).toBeGreaterThan(0)
    // More room to the right (5px) than left (0px) - goes right, uses all the room there is.
    expect(sensor).toMatchObject({ x: 0, x2: 5 })
  })
})
