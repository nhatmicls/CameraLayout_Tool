import type { SensorModel } from '../../catalog/sensor/sensor-catalog-loader'

/**
 * One-line coverage summary for a sensor catalog record, built only from
 * fields stored on the record - never rounded, never computed (plan risk
 * register: "card summary drifting from datasheet wording"). Used by both
 * the catalog card and the properties panel so the two never disagree.
 * PIR's printed angle can be 360 (a ceiling unit) - printed as-is, same as
 * any other angle.
 */
export function sensorCoverageSummary(model: SensorModel): string {
  switch (model.kind) {
    case 'pir':
      return `${model.coverage.rangeM} m / ${model.coverage.angleDeg}°`

    case 'beam':
      return beamSummary(model.maxDistanceOutdoorM, model.maxDistanceIndoorM)

    case 'vibration':
      return vibrationSummary(model.radii)

    case 'thermal':
      return `${model.focalMm} mm, HFOV ${model.hfovDeg}°, detect ${model.detectionRangeM.human.detect} m`
  }
}

function beamSummary(outdoorM: number | null, indoorM: number | null): string {
  const parts: string[] = []
  if (outdoorM !== null) parts.push(`${outdoorM} m outdoor`)
  if (indoorM !== null) parts.push(`${indoorM} m indoor`)
  return `max ${parts.join(' / ')}`
}

function vibrationSummary(radii: readonly { surface: string | null; radiusM: number }[]): string {
  if (radii.length === 1) {
    const [row] = radii
    return row.surface ? `r ${row.radiusM} m (${row.surface})` : `r ${row.radiusM} m`
  }
  const largest = Math.max(...radii.map((row) => row.radiusM))
  return `r up to ${largest} m (${radii.length} options)`
}
