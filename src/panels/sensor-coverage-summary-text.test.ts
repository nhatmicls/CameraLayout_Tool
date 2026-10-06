import { describe, expect, it } from 'vitest'
import { sensorModelById } from '../catalog/sensor-catalog-loader'
import { sensorCoverageSummary } from './sensor-coverage-summary-text'

function mustFind(id: string) {
  const model = sensorModelById(id)
  if (!model) throw new Error(`fixture catalog id not found: ${id}`)
  return model
}

describe('sensorCoverageSummary', () => {
  it('pir: range / angle, exactly as printed', () => {
    expect(sensorCoverageSummary(mustFind('hikvision-ds-pdpg12p-eg2-pir'))).toBe('12 m / 85.9°')
  })

  it('pir ceiling: a 360deg printed angle prints as 360°, same as any other sector', () => {
    expect(sensorCoverageSummary(mustFind('hikvision-ds-pdcl12-eg2-we'))).toBe('12 m / 360°')
  })

  it('beam: both printed distances, outdoor then indoor', () => {
    expect(sensorCoverageSummary(mustFind('takex-pb-60tk'))).toBe('max 60 m outdoor / 120 m indoor')
  })

  it('vibration: single row, no surface named', () => {
    expect(sensorCoverageSummary(mustFind('hikvision-ds-pdsk-p'))).toBe('r 2.5 m')
  })

  it('vibration: single row, surface named as printed', () => {
    expect(sensorCoverageSummary(mustFind('bosch-isc-sm-90'))).toBe('r 5 m (steel and iron-reinforced concrete)')
  })

  it('thermal: focal length, HFOV, human detect distance', () => {
    expect(sensorCoverageSummary(mustFind('dahua-tpc-bf2241-b3f4-dw-s2'))).toBe('3.5 mm, HFOV 50.6°, detect 146 m')
  })
})
