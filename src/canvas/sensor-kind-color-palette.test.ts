import { describe, expect, it } from 'vitest'
import {
  BEAM_BLOCKED_COLOR,
  BEAM_OVER_DISTANCE_COLOR,
  SENSOR_KIND_COLORS,
  SENSOR_MARKER_TINT,
  THERMAL_DRI_BAND_COLORS,
} from './sensor-kind-color-palette'
import { DORI_BAND_COLORS } from './brand-and-dori-color-palette'

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

function allSensorPaletteColors(): string[] {
  return [
    ...Object.values(SENSOR_KIND_COLORS),
    ...Object.values(THERMAL_DRI_BAND_COLORS),
    BEAM_BLOCKED_COLOR,
    BEAM_OVER_DISTANCE_COLOR,
  ]
}

describe('sensor-kind-color-palette', () => {
  it('every colour is a valid 6-digit hex string', () => {
    for (const color of allSensorPaletteColors()) {
      expect(color).toMatch(HEX_COLOR_PATTERN)
    }
  })

  it('every colour is distinct from every other sensor-palette colour', () => {
    const colors = allSensorPaletteColors()
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('every colour is distinct from every DORI band colour', () => {
    const doriColors = new Set(Object.values(DORI_BAND_COLORS))
    for (const color of allSensorPaletteColors()) {
      expect(doriColors.has(color)).toBe(false)
    }
  })

  it('SENSOR_MARKER_TINT mirrors SENSOR_KIND_COLORS for non-thermal kinds and uses the identify band colour for thermal', () => {
    expect(SENSOR_MARKER_TINT.pir).toBe(SENSOR_KIND_COLORS.pir)
    expect(SENSOR_MARKER_TINT.beam).toBe(SENSOR_KIND_COLORS.beam)
    expect(SENSOR_MARKER_TINT.vibration).toBe(SENSOR_KIND_COLORS.vibration)
    expect(SENSOR_MARKER_TINT.thermal).toBe(THERMAL_DRI_BAND_COLORS.identify)
  })
})
