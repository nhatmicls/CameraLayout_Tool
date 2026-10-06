import { describe, expect, it } from 'vitest'
import type { Wall } from './project-types'
import type { PlacedCircleSensor, PlacedSectorSensor, SensorModelSpec } from './sensor-types'
import { hasGlassWallClippingAnySensor, SENSOR_BLOCKING_WALL_KINDS } from './sensor-wall-blocking-rules'

describe('SENSOR_BLOCKING_WALL_KINDS', () => {
  it('pins pir and thermal to opaque + glass', () => {
    expect(SENSOR_BLOCKING_WALL_KINDS.pir).toEqual(['opaque', 'glass'])
    expect(SENSOR_BLOCKING_WALL_KINDS.thermal).toEqual(['opaque', 'glass'])
  })

  it('pins vibration and beam to opaque only', () => {
    expect(SENSOR_BLOCKING_WALL_KINDS.vibration).toEqual(['opaque'])
    expect(SENSOR_BLOCKING_WALL_KINDS.beam).toEqual(['opaque'])
  })
})

describe('hasGlassWallClippingAnySensor (L5)', () => {
  const glassWall: Wall = { id: 'w1', kind: 'glass', x1: 0, y1: 0, x2: 10, y2: 0 }
  const opaqueWall: Wall = { id: 'w2', kind: 'opaque', x1: 0, y1: 0, x2: 10, y2: 0 }
  const pirSpec: SensorModelSpec = { brand: 'hikvision', model: 'p1', kind: 'pir', coverage: { rangeM: 12, angleDeg: 90 } }
  const vibrationSpec: SensorModelSpec = { brand: 'bosch', model: 'v1', kind: 'vibration', detection: 'shock', radii: [{ surface: null, radiusM: 6 }] }
  const pirSensor: PlacedSectorSensor = { id: 's1', modelId: 'pir-1', shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
  const vibrationSensor: PlacedCircleSensor = { id: 's2', modelId: 'vib-1', shape: 'circle', x: 0, y: 0, radiusM: 5 }

  it('false with no glass wall, even with a clippable sensor', () => {
    expect(hasGlassWallClippingAnySensor([opaqueWall], [pirSensor], { 'pir-1': pirSpec })).toBe(false)
  })

  it('false with a glass wall but no sensor at all', () => {
    expect(hasGlassWallClippingAnySensor([glassWall], [], {})).toBe(false)
  })

  it('false with a glass wall and only a vibration sensor (glass does not clip it)', () => {
    expect(hasGlassWallClippingAnySensor([glassWall], [vibrationSensor], { 'vib-1': vibrationSpec })).toBe(false)
  })

  it('false with a glass wall and a sensor whose model is unknown (dangling modelId)', () => {
    expect(hasGlassWallClippingAnySensor([glassWall], [pirSensor], {})).toBe(false)
  })

  it('true with a glass wall and a pir sensor', () => {
    expect(hasGlassWallClippingAnySensor([glassWall], [pirSensor], { 'pir-1': pirSpec })).toBe(true)
  })

  it('true with a glass wall among others and a pir sensor among others', () => {
    expect(
      hasGlassWallClippingAnySensor([opaqueWall, glassWall], [vibrationSensor, pirSensor], {
        'vib-1': vibrationSpec,
        'pir-1': pirSpec,
      }),
    ).toBe(true)
  })
})
