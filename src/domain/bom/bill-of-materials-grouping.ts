import type { CameraModelSpec, PlacedCamera } from '../project-file/project-types'

export interface BomRow {
  /** "Camera", or the sensor kind label (`SENSOR_KIND_LABELS`) for a sensor row. */
  type: string
  brand: string
  model: string
  formFactor: string
  /** e.g. "2688x1520 (4 MP)". Empty for every sensor kind except thermal. */
  resolution: string
  /** e.g. "2.8 mm" or "2.8-12 mm". Empty for every sensor kind except thermal. */
  lens: string
  quantity: number
  /** Item labels for this row, derived from placement order, e.g. "C1, C3" or "S2, S5". */
  labels: string
  /** Indicative Vietnam unit price in VND, or null when the catalog has no price for this model. */
  unitPriceVnd: number | null
  /** `unitPriceVnd * quantity`, or null when the unit price is unknown. */
  lineTotalVnd: number | null
}

function lensLabel(lens: CameraModelSpec['lens']): string {
  return lens.kind === 'fixed' ? `${lens.focalMm} mm` : `${lens.focalMinMm}-${lens.focalMaxMm} mm`
}

/**
 * Groups placed cameras into BOM rows by (brand, model, lens) - the same
 * printed model name with a different lens option is a separate row, since
 * it is a separate purchasable part. Camera numbers (`C1`, `C2`, ...) come
 * from placement order in `cameras`, 1-based; unknown `modelId`s are skipped
 * (the project schema already reports those as warnings on load).
 */
export function groupCamerasIntoBom(
  cameras: PlacedCamera[],
  modelById: Record<string, CameraModelSpec>,
): BomRow[] {
  const groups = new Map<string, { model: CameraModelSpec; cameraNumbers: number[] }>()

  cameras.forEach((camera, index) => {
    const model = modelById[camera.modelId]
    if (!model) return

    const key = `${model.brand}\u0000${model.model}\u0000${lensLabel(model.lens)}`
    const group = groups.get(key)
    if (group) {
      group.cameraNumbers.push(index + 1)
    } else {
      groups.set(key, { model, cameraNumbers: [index + 1] })
    }
  })

  const rows: BomRow[] = Array.from(groups.values()).map(({ model, cameraNumbers }) => {
    const unitPriceVnd = model.priceVn?.amountVnd ?? null
    return {
      type: 'Camera',
      brand: model.brand,
      model: model.model,
      formFactor: model.formFactor,
      resolution: `${model.pixelWidth}x${model.pixelHeight} (${model.resolutionMp} MP)`,
      lens: lensLabel(model.lens),
      quantity: cameraNumbers.length,
      labels: cameraNumbers.map((n) => `C${n}`).join(', '),
      unitPriceVnd,
      lineTotalVnd: unitPriceVnd === null ? null : unitPriceVnd * cameraNumbers.length,
    }
  })

  rows.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model))
  return rows
}

export interface BomTotal {
  /** Sum of every priced row's line total, VND. */
  totalVnd: number
  /** Number of placed items (cameras and/or sensors) whose model has no catalog price - excluded from `totalVnd`. */
  unpricedQuantity: number
}

/**
 * Grand total over the priced rows, plus how many items it leaves out (so a
 * partial total is never shown as complete). Works on rows, not cameras -
 * camera and sensor rows join the total identically, no special-casing
 * needed here when sensor rows are included in `rows`.
 */
export function computeBomTotal(rows: BomRow[]): BomTotal {
  let totalVnd = 0
  let unpricedQuantity = 0
  for (const row of rows) {
    if (row.lineTotalVnd === null) unpricedQuantity += row.quantity
    else totalVnd += row.lineTotalVnd
  }
  return { totalVnd, unpricedQuantity }
}

const VND_NUMBER_FORMAT = new Intl.NumberFormat('vi-VN')

/** VND amount with vi-VN digit grouping and no currency sign, e.g. "1.250.000" - for cells under a header that already says VND. */
export function formatVndNumber(amountVnd: number): string {
  return VND_NUMBER_FORMAT.format(amountVnd)
}

/** Human-readable VND amount, e.g. "1.250.000 ₫". */
export function formatVnd(amountVnd: number): string {
  return `${formatVndNumber(amountVnd)} ₫`
}

const BOM_HEADER = [
  'Type',
  'Brand',
  'Model',
  'Form Factor',
  'Resolution',
  'Lens',
  'Quantity',
  'Labels',
  'Unit Price (VND)',
  'Total (VND)',
]

/**
 * Shared by CSV export and the PNG export strip (DRY) - header row plus one
 * row per BOM entry (cameras, then sensors - the caller concatenates
 * `groupCamerasIntoBom` + `groupSensorsIntoBom` results in that order).
 * Prices default to plain integers (what a spreadsheet wants from the CSV);
 * the PNG strip passes a grouping formatter instead. An unknown price is an
 * empty cell.
 */
export function bomToTable(rows: BomRow[], formatPrice: (amountVnd: number) => string = String): string[][] {
  const price = (amountVnd: number | null) => (amountVnd === null ? '' : formatPrice(amountVnd))
  return [
    BOM_HEADER,
    ...rows.map((r) => [
      r.type,
      r.brand,
      r.model,
      r.formFactor,
      r.resolution,
      r.lens,
      String(r.quantity),
      r.labels,
      price(r.unitPriceVnd),
      price(r.lineTotalVnd),
    ]),
  ]
}
