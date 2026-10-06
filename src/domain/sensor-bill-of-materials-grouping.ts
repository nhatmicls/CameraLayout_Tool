import type { BomRow } from './bill-of-materials-grouping'
import { SENSOR_KIND_LABELS, type PlacedSensor, type SensorModelSpec } from './sensor-types'

type ThermalModelSpec = Extract<SensorModelSpec, { kind: 'thermal' }>

/** "400x300"-style, values as stored in the catalog - never computed. */
function thermalResolution(model: ThermalModelSpec): string {
  return `${model.pixelWidth}x${model.pixelHeight}`
}

/** "7.5 mm"-style, value as stored in the catalog. */
function thermalLens(model: ThermalModelSpec): string {
  return `${model.focalMm} mm`
}

/**
 * Groups placed sensors into BOM rows, the sensor twin of
 * `groupCamerasIntoBom`. Deviations from the camera grouping (CLAUDE.md /
 * plan Phase 7 decisions):
 * - `formFactor` is always empty - the catalog has no PIR mount field (pir
 *   is always a sector, ceiling = 360deg), so there is nothing to show.
 * - `resolution`/`lens` are filled only for thermal (pixel size and focal
 *   length, as printed); every other kind leaves them empty.
 * - Grouping key is (kind, brand, model), plus `focalMm` for thermal - each
 *   thermal lens is already its own catalog id, so this only guards against
 *   two different catalog ids printing the same brand+model text.
 * - Labels (`S1`, `S2`, ...) come from the sensor's position in `sensors[]`,
 *   1-based and independent of camera numbering. One placed beam (a single
 *   `PlacedBeamSensor`, already a TX+RX set) counts as quantity 1.
 * - Unknown `modelId`s are skipped, same as the camera grouping.
 */
export function groupSensorsIntoBom(sensors: PlacedSensor[], modelById: Record<string, SensorModelSpec>): BomRow[] {
  const groups = new Map<string, { model: SensorModelSpec; sensorNumbers: number[] }>()

  sensors.forEach((sensor, index) => {
    const model = modelById[sensor.modelId]
    if (!model) return

    const lensKey = model.kind === 'thermal' ? `\u0000${model.focalMm}` : ''
    const key = `${model.kind}\u0000${model.brand}\u0000${model.model}${lensKey}`
    const group = groups.get(key)
    if (group) {
      group.sensorNumbers.push(index + 1)
    } else {
      groups.set(key, { model, sensorNumbers: [index + 1] })
    }
  })

  const rows: BomRow[] = Array.from(groups.values()).map(({ model, sensorNumbers }) => {
    const unitPriceVnd = model.priceVn?.amountVnd ?? null
    return {
      type: SENSOR_KIND_LABELS[model.kind],
      brand: model.brand,
      model: model.model,
      formFactor: '',
      resolution: model.kind === 'thermal' ? thermalResolution(model) : '',
      lens: model.kind === 'thermal' ? thermalLens(model) : '',
      quantity: sensorNumbers.length,
      labels: sensorNumbers.map((n) => `S${n}`).join(', '),
      unitPriceVnd,
      lineTotalVnd: unitPriceVnd === null ? null : unitPriceVnd * sensorNumbers.length,
    }
  })

  rows.sort((a, b) => a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model))
  return rows
}
