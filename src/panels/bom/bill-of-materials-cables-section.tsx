import type { BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { SCALE_NOT_SET_CABLE_MESSAGE } from '../../domain/cable/cable-layout-estimate'
import { BillOfMaterialsCableRowsTable } from './bill-of-materials-cable-rows-table'

interface BillOfMaterialsCablesSectionProps {
  showHeading: boolean
  /** Whether at least one floor currently in view has a scale set. */
  hasScaleInView: boolean
  cableRows: BomRow[]
  /** "No cable metres for F2 Level 2: scale not set." (project-wide view only); null otherwise. */
  floorsWithoutScaleNote: string | null
  /** "N cable(s) not estimated: ..." (a linked floor's scale missing, no exit chosen, a cycle); null when nothing is excluded. */
  unestimatedNote: string | null
}

/**
 * The BOM panel's "Cables" sub-section - extracted to keep
 * `bill-of-materials-panel.tsx` under the project's line-count guideline.
 * M1 review fix: the generic "calibrate the scale" message is about the
 * floor(s) IN VIEW really having no scale (`hasScaleInView`), never shown
 * just because `cableRows` happens to be empty for some OTHER reason (every
 * cable in view unestimated) while a floor in view is actually scaled -
 * that case shows nothing here and lets `unestimatedNote` explain why.
 */
export function BillOfMaterialsCablesSection({
  showHeading,
  hasScaleInView,
  cableRows,
  floorsWithoutScaleNote,
  unestimatedNote,
}: BillOfMaterialsCablesSectionProps) {
  return (
    <>
      {showHeading && <h3 className="mt-3 text-xs font-semibold text-neutral-600">Cables</h3>}
      {!hasScaleInView ? (
        <p data-testid="bom-cables-no-scale" className="text-xs font-medium text-amber-600">
          {SCALE_NOT_SET_CABLE_MESSAGE}
        </p>
      ) : (
        cableRows.length > 0 && <BillOfMaterialsCableRowsTable rows={cableRows} />
      )}
      {floorsWithoutScaleNote && (
        <p data-testid="bom-cables-floors-without-scale" className="mt-1 text-xs font-medium text-amber-600">
          {floorsWithoutScaleNote}
        </p>
      )}
      {unestimatedNote && (
        <p data-testid="bom-cables-unestimated" className="mt-1 text-xs font-medium text-amber-600">
          {unestimatedNote}
        </p>
      )}
    </>
  )
}
