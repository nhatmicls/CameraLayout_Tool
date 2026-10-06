import { describe, expect, it } from 'vitest'
import { applyPlacedSensorPatch } from './placed-sensor-patch'
import type { PlacedBeamSensor, PlacedCircleSensor, PlacedSectorSensor } from './sensor-types'

describe('applyPlacedSensorPatch', () => {
  const sector: PlacedSectorSensor = { id: 's1', modelId: 'pir-1', shape: 'sector', x: 0, y: 0, rotationDeg: 10, rangeM: 10 }
  const circle: PlacedCircleSensor = { id: 'c1', modelId: 'vib-1', shape: 'circle', x: 0, y: 0, radiusM: 6 }
  const beam: PlacedBeamSensor = { id: 'b1', modelId: 'beam-1', shape: 'beam', x: 0, y: 0, x2: 10, y2: 0, environment: 'outdoor' }

  it('applies a matching patch on a sector sensor', () => {
    const next = applyPlacedSensorPatch(sector, { rotationDeg: 45, rangeM: 20, angleDeg: 90 })
    expect(next).toMatchObject({ rotationDeg: 45, rangeM: 20, angleDeg: 90 })
  })

  it('ignores a radiusM patch on a sector sensor', () => {
    const next = applyPlacedSensorPatch(sector, { radiusM: 99 } as never)
    expect(next).toBe(sector)
  })

  it('ignores a rotationDeg patch on a circle sensor but applies radiusM', () => {
    const next = applyPlacedSensorPatch(circle, { rotationDeg: 45, radiusM: 8 } as never)
    expect(next).toMatchObject({ radiusM: 8 })
    expect(next).not.toHaveProperty('rotationDeg')
  })

  it('applies x2/y2/environment on a beam sensor and ignores rangeM', () => {
    const next = applyPlacedSensorPatch(beam, { x2: 50, y2: 5, environment: 'indoor', rangeM: 5 } as never)
    expect(next).toMatchObject({ x2: 50, y2: 5, environment: 'indoor' })
    expect(next).not.toHaveProperty('rangeM')
  })

  it('always applies x / y regardless of shape', () => {
    expect(applyPlacedSensorPatch(sector, { x: 5, y: 6 })).toMatchObject({ x: 5, y: 6 })
    expect(applyPlacedSensorPatch(circle, { x: 5, y: 6 })).toMatchObject({ x: 5, y: 6 })
    expect(applyPlacedSensorPatch(beam, { x: 5, y: 6 })).toMatchObject({ x: 5, y: 6 })
  })

  it('returns the same reference (identity) when nothing in the patch applies', () => {
    expect(applyPlacedSensorPatch(sector, {})).toBe(sector)
    expect(applyPlacedSensorPatch(circle, {})).toBe(circle)
    expect(applyPlacedSensorPatch(beam, {})).toBe(beam)
  })

  // A patch key present but equal to the current value must not count as a change (blur after
  // re-typing the same number, clicking the already-active environment, Reset at the default) -
  // each of these must return the original reference, not a new object with an extra undo step.
  it('returns identity for a same-value patch: rotationDeg equal to current', () => {
    expect(applyPlacedSensorPatch(sector, { rotationDeg: sector.rotationDeg })).toBe(sector)
  })

  it('returns identity for a same-value patch: radiusM equal to current', () => {
    expect(applyPlacedSensorPatch(circle, { radiusM: circle.radiusM })).toBe(circle)
  })

  it('returns identity for a same-value patch: beam environment equal to current', () => {
    expect(applyPlacedSensorPatch(beam, { environment: beam.environment })).toBe(beam)
  })

  it('returns identity for a same-value patch: x/y equal to current, regardless of shape', () => {
    expect(applyPlacedSensorPatch(sector, { x: sector.x, y: sector.y })).toBe(sector)
  })

  it('still applies a partial patch with one changed and one unchanged key', () => {
    const next = applyPlacedSensorPatch(sector, { rotationDeg: sector.rotationDeg, rangeM: 25 })
    expect(next).not.toBe(sector)
    expect(next).toMatchObject({ rotationDeg: sector.rotationDeg, rangeM: 25 })
  })
})
