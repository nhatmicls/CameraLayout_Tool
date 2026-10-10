import { describe, expect, it } from 'vitest'
import { groupSensorsIntoBom } from './sensor-bill-of-materials-grouping'
import type { PlacedBeamSensor, PlacedCircleSensor, PlacedSectorSensor, SensorModelSpec } from '../sensor/sensor-types'

const pirCeiling: SensorModelSpec = {
  brand: 'hikvision',
  model: 'DS-PD1-MC',
  priceVn: { amountVnd: 450_000 },
  kind: 'pir',
  coverage: { rangeM: 12, angleDeg: 360 },
}

const beamOutdoor: SensorModelSpec = {
  brand: 'takex',
  model: 'PB-100NA',
  priceVn: null,
  kind: 'beam',
  maxDistanceOutdoorM: 100,
  maxDistanceIndoorM: null,
}

const vibration: SensorModelSpec = {
  brand: 'bosch',
  model: 'DS160',
  priceVn: { amountVnd: 300_000 },
  kind: 'vibration',
  detection: 'shock',
  radii: [{ surface: 'glass', radiusM: 5 }],
}

const thermal75mm: SensorModelSpec = {
  brand: 'dahua',
  model: 'TPC-BF5401',
  priceVn: { amountVnd: 20_000_000 },
  kind: 'thermal',
  pixelWidth: 400,
  pixelHeight: 300,
  focalMm: 7.5,
  hfovDeg: 24,
  detectionRangeM: { human: { detect: 300, recognize: 150, identify: 75 }, vehicle: null },
}

const thermal35mm: SensorModelSpec = {
  ...thermal75mm,
  focalMm: 3.5,
  pixelWidth: 256,
  pixelHeight: 192,
}

const modelById: Record<string, SensorModelSpec> = {
  'hik-pir-ceiling': pirCeiling,
  'takex-beam': beamOutdoor,
  'bosch-vibration': vibration,
  'dahua-thermal-7.5': thermal75mm,
  'dahua-thermal-3.5': thermal35mm,
}

function sectorSensor(modelId: string): PlacedSectorSensor {
  return { id: `sensor-${modelId}`, modelId, shape: 'sector', x: 0, y: 0, rotationDeg: 0, rangeM: 10 }
}

function circleSensor(modelId: string): PlacedCircleSensor {
  return { id: `sensor-${modelId}`, modelId, shape: 'circle', x: 0, y: 0, radiusM: 5 }
}

function beamSensor(modelId: string): PlacedBeamSensor {
  return { id: `sensor-${modelId}`, modelId, shape: 'beam', x: 0, y: 0, x2: 10, y2: 10, environment: 'outdoor' }
}

/** `groupSensorsIntoBom` takes labels from the shared allocator - a simple "S{n}" series is all this grouper-only test needs. */
function sensorLabels(sensors: readonly { id: string }[]): string[] {
  return sensors.map((_, i) => `S${i + 1}`)
}

describe('groupSensorsIntoBom', () => {
  it('leaves Form Factor empty for every sensor kind (no PIR mount field in the catalog)', () => {
    const sensors = [sectorSensor('hik-pir-ceiling')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    expect(rows[0].formFactor).toBe('')
  })

  it('leaves Resolution and Lens empty for non-thermal kinds', () => {
    const sensors = [sectorSensor('hik-pir-ceiling'), circleSensor('bosch-vibration'), beamSensor('takex-beam')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    for (const row of rows) {
      expect(row.resolution).toBe('')
      expect(row.lens).toBe('')
    }
  })

  it('fills Resolution and Lens for thermal, as printed', () => {
    const sensors = [sectorSensor('dahua-thermal-7.5')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    expect(rows[0].resolution).toBe('400x300')
    expect(rows[0].lens).toBe('7.5 mm')
  })

  it('splits thermal rows by lens (each lens is its own catalog id)', () => {
    const sensors = [sectorSensor('dahua-thermal-7.5'), sectorSensor('dahua-thermal-3.5')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.lens).sort()).toEqual(['3.5 mm', '7.5 mm'])
  })

  it('counts one placed beam as quantity 1 (a TX+RX set)', () => {
    const sensors = [beamSensor('takex-beam')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    expect(rows[0].quantity).toBe(1)
    expect(rows[0].unitPriceVnd).toBeNull()
    expect(rows[0].lineTotalVnd).toBeNull()
  })

  it('numbers labels from the given labels array, independent of grouping order', () => {
    const sensors = [sectorSensor('hik-pir-ceiling'), circleSensor('bosch-vibration'), sectorSensor('hik-pir-ceiling')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    const pirRow = rows.find((r) => r.model === 'DS-PD1-MC')
    expect(pirRow?.labels).toBe('S1, S3')
  })

  it('skips sensors with an unknown modelId, keeping the given labels for the rest', () => {
    const sensors = [sectorSensor('unknown-model'), sectorSensor('hik-pir-ceiling'), sectorSensor('unknown-model'), sectorSensor('hik-pir-ceiling')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    expect(rows).toHaveLength(1)
    expect(rows[0].labels).toBe('S2, S4')
  })

  it('sorts rows by type label, then brand, then model', () => {
    const sensors = [beamSensor('takex-beam'), sectorSensor('hik-pir-ceiling'), circleSensor('bosch-vibration'), sectorSensor('dahua-thermal-7.5')]
    const rows = groupSensorsIntoBom(sensors, modelById, sensorLabels(sensors))
    expect(rows.map((r) => r.type)).toEqual(['IR beam', 'PIR motion', 'Thermal camera', 'Vibration / glass-break'])
  })

  it('returns an empty array for no sensors', () => {
    expect(groupSensorsIntoBom([], modelById, [])).toEqual([])
  })
})
