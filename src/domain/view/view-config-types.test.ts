import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW_CONFIG, revealCameraFormFactorInView, revealSensorKindInView, type ViewConfig } from './view-config-types'

describe('DEFAULT_VIEW_CONFIG', () => {
  it('shows everything', () => {
    const { cameraFormFactors, sensorKinds, ...flags } = DEFAULT_VIEW_CONFIG
    expect(Object.values(flags).every((on) => on === true)).toBe(true)
    expect(Object.values(cameraFormFactors)).toEqual([true, true, true, true, true])
    expect(Object.values(sensorKinds)).toEqual([true, true, true, true])
  })

  it('is frozen, nested records included', () => {
    expect(Object.isFrozen(DEFAULT_VIEW_CONFIG)).toBe(true)
    expect(Object.isFrozen(DEFAULT_VIEW_CONFIG.cameraFormFactors)).toBe(true)
    expect(Object.isFrozen(DEFAULT_VIEW_CONFIG.sensorKinds)).toBe(true)
  })
})

describe('revealCameraFormFactorInView', () => {
  it('returns the same object when the form factor is already visible', () => {
    expect(revealCameraFormFactorInView(DEFAULT_VIEW_CONFIG, 'dome')).toBe(DEFAULT_VIEW_CONFIG)
  })

  it('turns on the master markers flag and that form factor, and leaves the cones flag alone', () => {
    const hidden: ViewConfig = {
      ...DEFAULT_VIEW_CONFIG,
      cameraMarkers: false,
      cameraCones: false,
      cameraFormFactors: { ...DEFAULT_VIEW_CONFIG.cameraFormFactors, dome: false, ptz: false },
    }
    const next = revealCameraFormFactorInView(hidden, 'dome')
    expect(next.cameraMarkers).toBe(true)
    expect(next.cameraFormFactors.dome).toBe(true)
    expect(next.cameraFormFactors.ptz).toBe(false)
    expect(next.cameraCones).toBe(false)
    expect(hidden.cameraMarkers).toBe(false) // input not mutated
  })

  it('ignores an unknown form factor', () => {
    const hidden: ViewConfig = { ...DEFAULT_VIEW_CONFIG, cameraMarkers: false }
    expect(revealCameraFormFactorInView(hidden, 'box')).toBe(hidden)
    expect(revealCameraFormFactorInView(hidden, undefined)).toBe(hidden)
  })
})

describe('revealSensorKindInView', () => {
  it('returns the same object when the kind is already visible', () => {
    expect(revealSensorKindInView(DEFAULT_VIEW_CONFIG, 'beam')).toBe(DEFAULT_VIEW_CONFIG)
  })

  it('turns on the master markers flag and that kind, and leaves the coverage flag alone', () => {
    const hidden: ViewConfig = {
      ...DEFAULT_VIEW_CONFIG,
      sensorMarkers: false,
      sensorCoverage: false,
      sensorKinds: { ...DEFAULT_VIEW_CONFIG.sensorKinds, thermal: false, pir: false },
    }
    const next = revealSensorKindInView(hidden, 'thermal')
    expect(next.sensorMarkers).toBe(true)
    expect(next.sensorKinds.thermal).toBe(true)
    expect(next.sensorKinds.pir).toBe(false)
    expect(next.sensorCoverage).toBe(false)
  })

  it('ignores an unknown kind', () => {
    const hidden: ViewConfig = { ...DEFAULT_VIEW_CONFIG, sensorMarkers: false }
    expect(revealSensorKindInView(hidden, undefined)).toBe(hidden)
  })
})
