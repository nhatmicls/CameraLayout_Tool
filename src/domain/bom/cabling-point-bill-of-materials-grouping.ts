import type { Hub } from '../cable/cable-layout-types'
import type { BomRow } from './bill-of-materials-grouping'

type CablingPointKind = 'hub' | 'riser' | 'drop' | 'shaft'

/** Fixed row order (owner decision 2026-10-09, phase 6) - never alphabetical, never placement order. */
const CABLING_POINT_KIND_ORDER: readonly CablingPointKind[] = ['hub', 'riser', 'drop', 'shaft']

const CABLING_POINT_TYPE_LABELS: Record<CablingPointKind, string> = {
  hub: 'Cable hub',
  riser: 'Riser',
  drop: 'Drop',
  shaft: 'Shaft opening',
}

/** `CABLING_POINT_KIND_ORDER` mapped to their row-facing `type` text - built once, module load time. */
const CABLING_POINT_TYPE_LABEL_ORDER = CABLING_POINT_KIND_ORDER.map((kind) => CABLING_POINT_TYPE_LABELS[kind])

/**
 * Groups hub/riser/drop/shaft-opening markers into BOM rows (owner decision
 * 2026-10-09, phase 6): these are placement points, not catalog items, so
 * they have no brand/model/price - the price cells print the literal "TBD"
 * (`priceTbd: true` on `BomRow`), never an invented number. `hubLabels` is
 * index-aligned with `hubs` (the ONE shared allocator's own `hubs` array,
 * `floor-item-label-allocator.ts`'s `buildFloorItemLabels` - this function
 * numbers nothing itself); a shaft marker's label is already its project-
 * wide "T{n}" from there. Shaft counts PER MARKER (one opening per floor) -
 * a cable's own route beyond the shaft (`Cable.beyondShaft`) is a cable,
 * never a row here. Only kinds with at least one marker produce a row.
 */
export function groupCablingPointsIntoBom(hubs: readonly Hub[], hubLabels: readonly string[]): BomRow[] {
  const labelsByKind = new Map<CablingPointKind, string[]>()

  hubs.forEach((hub, index) => {
    const kind: CablingPointKind = hub.kind ?? 'hub'
    const labels = labelsByKind.get(kind) ?? []
    labels.push(hubLabels[index])
    labelsByKind.set(kind, labels)
  })

  return CABLING_POINT_KIND_ORDER.filter((kind) => (labelsByKind.get(kind)?.length ?? 0) > 0).map((kind) => {
    const labels = labelsByKind.get(kind)!
    return {
      type: CABLING_POINT_TYPE_LABELS[kind],
      brand: '',
      model: '',
      formFactor: '',
      resolution: '',
      lens: '',
      quantity: labels.length,
      unit: 'pcs',
      labels: labels.join(', '),
      unitPriceVnd: null,
      lineTotalVnd: null,
      priceTbd: true,
    }
  })
}

/** Cabling-point row order: fixed kind order (`CABLING_POINT_KIND_ORDER`), never alphabetical - exported so `merge-bom-rows-across-floors.ts` re-sorts a cross-floor merge with the SAME order instead of re-implementing it. */
export function compareCablingPointBomRows(a: BomRow, b: BomRow): number {
  return CABLING_POINT_TYPE_LABEL_ORDER.indexOf(a.type) - CABLING_POINT_TYPE_LABEL_ORDER.indexOf(b.type)
}
