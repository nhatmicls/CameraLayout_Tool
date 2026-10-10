import type { CameraModelSpec, PlacedCamera } from '../project-file/project-types'

/** What `BomRow.quantity` counts: pieces (cameras, sensors) or metres (cables). */
export type BomUnit = 'pcs' | 'm'

export interface BomRow {
  /** "Camera", the sensor kind label (`SENSOR_KIND_LABELS`) for a sensor row, or "Cable". */
  type: string
  brand: string
  model: string
  formFactor: string
  /** e.g. "2688x1520 (4 MP)". Empty for every sensor kind except thermal. */
  resolution: string
  /** e.g. "2.8 mm" or "2.8-12 mm". Empty for every sensor kind except thermal. */
  lens: string
  quantity: number
  unit: BomUnit
  /** Item labels for this row, derived from placement order, e.g. "C1, C3" or "S2, S5". */
  labels: string
  /** Indicative Vietnam unit price in VND, or null when the catalog has no price for this model. */
  unitPriceVnd: number | null
  /** `unitPriceVnd * quantity`, or null when the unit price is unknown. */
  lineTotalVnd: number | null
  /** CSV-only extra column (Validation Session 1): a fire-alarm compatibility-warning note for this grouped row, e.g. "Not listed for a placed panel/hub: F3, F7" or "No panel/hub placed". Undefined/empty for every camera, sensor and cable row, and for a fire row with no warning. Never shown in the PNG table (`bomToTable`) - only `bomToCsvTable` reads it. */
  notes?: string
  /**
   * Owner decision 2026-10-09 (phase 6): a hub/riser/drop/shaft-opening
   * marker row has no catalog model, so no price can exist by design - its
   * price cells print the literal `BOM_PRICE_TBD_TEXT` ("TBD") instead of a
   * number. `unitPriceVnd`/`lineTotalVnd` stay `null` on these rows (every
   * existing sum already skips `null`); `computeBomTotal` counts their
   * quantity into `BomTotal.tbdQuantity`, NEVER into `unpricedQuantity`
   * (that field means "a catalog model with no listed price").
   */
  priceTbd?: true
}

/** The literal price-cell text for a row whose price is unknown by design (`BomRow.priceTbd`) - never a number, never invented. */
export const BOM_PRICE_TBD_TEXT = 'TBD'

function lensLabel(lens: CameraModelSpec['lens']): string {
  return lens.kind === 'fixed' ? `${lens.focalMm} mm` : `${lens.focalMinMm}-${lens.focalMaxMm} mm`
}

/**
 * Groups placed cameras into BOM rows by (brand, model, lens) - the same
 * printed model name with a different lens option is a separate row, since
 * it is a separate purchasable part. `labels` is index-aligned with
 * `cameras` (from the ONE shared allocator, `floor-item-label-allocator.ts`'s
 * `buildFloorItemLabels` - this function no longer numbers anything itself);
 * unknown `modelId`s are skipped (the project schema already reports those
 * as warnings on load).
 */
export function groupCamerasIntoBom(
  cameras: PlacedCamera[],
  modelById: Record<string, CameraModelSpec>,
  labels: readonly string[],
): BomRow[] {
  const groups = new Map<string, { model: CameraModelSpec; cameraLabels: string[] }>()

  cameras.forEach((camera, index) => {
    const model = modelById[camera.modelId]
    if (!model) return

    const key = `${model.brand}\u0000${model.model}\u0000${lensLabel(model.lens)}`
    const group = groups.get(key)
    if (group) {
      group.cameraLabels.push(labels[index])
    } else {
      groups.set(key, { model, cameraLabels: [labels[index]] })
    }
  })

  const rows: BomRow[] = Array.from(groups.values()).map(({ model, cameraLabels }) => {
    const unitPriceVnd = model.priceVn?.amountVnd ?? null
    return {
      type: 'Camera',
      brand: model.brand,
      model: model.model,
      formFactor: model.formFactor,
      resolution: `${model.pixelWidth}x${model.pixelHeight} (${model.resolutionMp} MP)`,
      lens: lensLabel(model.lens),
      quantity: cameraLabels.length,
      unit: 'pcs',
      labels: cameraLabels.join(', '),
      unitPriceVnd,
      lineTotalVnd: unitPriceVnd === null ? null : unitPriceVnd * cameraLabels.length,
    }
  })

  rows.sort(compareCameraBomRows)
  return rows
}

/** Camera row order: brand, then model - exported so `merge-bom-rows-across-floors.ts` re-sorts a cross-floor merge with the SAME comparator instead of re-implementing it. */
export function compareCameraBomRows(a: BomRow, b: BomRow): number {
  return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model)
}

export interface BomTotal {
  /** Sum of every priced row's line total, VND. */
  totalVnd: number
  /** Number of placed items (cameras and/or sensors) whose model has no catalog price - excluded from `totalVnd`. Pieces only: cable metres never count here. */
  unpricedQuantity: number
  /** Number of cable rows (unit `m`) with no price - excluded from `totalVnd`. */
  unpricedCableTypeCount: number
  /** Number of placed cabling-point markers (hub/riser/drop/shaft-opening, `row.priceTbd`) - excluded from `totalVnd` AND from `unpricedQuantity` (owner decision 2026-10-09, phase 6: "TBD by design" is not "missing a catalog price"). */
  tbdQuantity: number
}

/**
 * Grand total over the priced rows, plus how many items it leaves out (so a
 * partial total is never shown as complete). Works on rows, not cameras -
 * camera and sensor rows join the total identically. Unpriced rows are
 * split by unit: a cable row's quantity is metres, which must not be added
 * to the count of unpriced items. A `priceTbd` row (a cabling-point marker)
 * is counted apart from both - it was never going to have a catalog price.
 */
export function computeBomTotal(rows: BomRow[]): BomTotal {
  let totalVnd = 0
  let unpricedQuantity = 0
  let unpricedCableTypeCount = 0
  let tbdQuantity = 0
  for (const row of rows) {
    if (row.priceTbd) {
      tbdQuantity += row.quantity
    } else if (row.lineTotalVnd !== null) {
      totalVnd += row.lineTotalVnd
    } else if (row.unit === 'm') {
      unpricedCableTypeCount += 1
    } else {
      unpricedQuantity += row.quantity
    }
  }
  return { totalVnd, unpricedQuantity, unpricedCableTypeCount, tbdQuantity }
}

const BOM_HEADER = [
  'Type',
  'Brand',
  'Model',
  'Form Factor',
  'Resolution',
  'Lens',
  'Quantity',
  'Unit',
  'Labels',
  'Unit Price (VND)',
  'Total (VND)',
]

/** CSV-only header (Validation Session 1): the PNG table's 11 columns plus a trailing `Notes` column - the strip has no width to spare, but the CSV carries the compatibility-warning note. */
const BOM_CSV_HEADER = [...BOM_HEADER, 'Notes']

/** The 11 cells shared by every row rendering, before any CSV-only `Notes` cell is appended. A `priceTbd` row prints the literal `BOM_PRICE_TBD_TEXT` in both price cells instead of running them through `price()`. */
function bomRowCells(r: BomRow, price: (amountVnd: number | null) => string): string[] {
  const priceCell = (amountVnd: number | null) => (r.priceTbd ? BOM_PRICE_TBD_TEXT : price(amountVnd))
  return [
    r.type,
    r.brand,
    r.model,
    r.formFactor,
    r.resolution,
    r.lens,
    String(r.quantity),
    r.unit,
    r.labels,
    priceCell(r.unitPriceVnd),
    priceCell(r.lineTotalVnd),
  ]
}

/**
 * Shared by the PNG export strip and `bomToCsvTable` (DRY) - header row plus
 * one row per BOM entry (cameras, then sensors, then fire-alarm devices,
 * then cables - see `build-combined-bom-rows.ts`). 11 columns, never 12: the
 * PNG strip has no width to spare for `notes` (its legend line already
 * carries the compatibility warning).
 * Prices default to plain integers (what a spreadsheet wants from the CSV);
 * the PNG strip passes a grouping formatter instead. An unknown price is an
 * empty cell.
 */
export function bomToTable(rows: BomRow[], formatPrice: (amountVnd: number) => string = String): string[][] {
  const price = (amountVnd: number | null) => (amountVnd === null ? '' : formatPrice(amountVnd))
  return [BOM_HEADER, ...rows.map((r) => bomRowCells(r, price))]
}

/**
 * CSV-only table (Validation Session 1 owner decision): `bomToTable`'s 11
 * columns plus a trailing `Notes` cell per row (`r.notes ?? ''`) - empty for
 * every camera, sensor and cable row, and for a fire row with no
 * compatibility warning. Breaking for a strict CSV parser that asserts the
 * column count (documented in README, phase 9).
 */
export function bomToCsvTable(rows: BomRow[], formatPrice: (amountVnd: number) => string = String): string[][] {
  const price = (amountVnd: number | null) => (amountVnd === null ? '' : formatPrice(amountVnd))
  return [BOM_CSV_HEADER, ...rows.map((r) => [...bomRowCells(r, price), r.notes ?? ''])]
}
