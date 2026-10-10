import type { BomRow } from '../../domain/bom/bill-of-materials-grouping'
import { BillOfMaterialsRow } from './bill-of-materials-row'
import { BillOfMaterialsTableHeaderRow } from './bill-of-materials-table-header-row'

interface BillOfMaterialsRowsSectionProps {
  heading: string
  showHeading: boolean
  rows: BomRow[]
  labelsTestIdPrefix: 'cameras' | 'labels' | 'fire-alarm' | 'cabling-point'
  /** Stable per-row id - same convention as `bomRowSlug` in `bill-of-materials-panel.tsx`. */
  slugFor: (row: BomRow) => string
  /** Only the first table in the panel renders without the `mt-3` top margin (M4 review fix: keeps the pre-existing single-table spacing). */
  isFirst?: boolean
}

/**
 * One BOM sub-section: an optional heading plus a table of rows - shared by
 * every row family (cameras, sensors, fire-alarm devices, cabling points).
 * Extracted (DRY) so `bill-of-materials-panel.tsx` stays under the
 * project's line-count guideline instead of repeating this markup four
 * times. Renders nothing for an empty `rows` (a camera/sensor/fire-alarm
 * table never used to render a truly empty array).
 */
export function BillOfMaterialsRowsSection({ heading, showHeading, rows, labelsTestIdPrefix, slugFor, isFirst }: BillOfMaterialsRowsSectionProps) {
  if (rows.length === 0) return null
  return (
    <>
      {showHeading && <h3 className={`${isFirst ? '' : 'mt-3 '}text-xs font-semibold text-neutral-600`}>{heading}</h3>}
      <table className="w-full min-w-[400px] text-left text-xs">
        <thead>
          <BillOfMaterialsTableHeaderRow />
        </thead>
        <tbody>
          {rows.map((row) => (
            <BillOfMaterialsRow key={slugFor(row)} row={row} slug={slugFor(row)} labelsTestIdPrefix={labelsTestIdPrefix} />
          ))}
        </tbody>
      </table>
    </>
  )
}
