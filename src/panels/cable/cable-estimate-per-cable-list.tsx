import { cableTypeColor } from '../../canvas/cable/cable-type-color-palette'
import type { CableListRow } from '../../domain/cable/project-cable-list-rows'
import { formatMeters } from '../../domain/cable/cable-length-format'
import type { CableType } from '../../domain/cable/cable-layout-types'

interface CableEstimatePerCableListProps {
  rows: readonly CableListRow[]
  cableTypes: CableType[]
  /** Live `cableSettings.wastePercent` - shown as "spare". */
  sparePercent: number
}

/**
 * One row per cable (keyed by `cableId`, never by its label - two cables can
 * share one): its type colour/name, its length including the live spare
 * allowance, or the reason it has none (amber, same wording the CSV's
 * `Notes` column uses). Pure presentation over `buildProjectCableListRows`.
 */
export function CableEstimatePerCableList({ rows, cableTypes, sparePercent }: CableEstimatePerCableListProps) {
  if (rows.length === 0) {
    return (
      <p data-testid="cable-list-empty-state" className="mt-1 text-xs text-neutral-400">
        No cables drawn yet.
      </p>
    )
  }

  return (
    <div className="mt-1 text-xs">
      <ul data-testid="cable-list" className="max-h-48 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.cableId} data-testid={`cable-list-row-${row.cableId}`} className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span
                className="h-2 w-2 flex-shrink-0 translate-y-[1px] rounded-full"
                style={{ backgroundColor: cableTypeColor(cableTypes.findIndex((type) => type.id === row.typeId)) }}
              />
              <span data-testid={`cable-list-label-${row.cableId}`} className="break-all text-neutral-800">
                {row.label}
              </span>
              <span className="flex-shrink-0 truncate text-neutral-400">{row.typeName}</span>
            </span>
            <span data-testid={`cable-list-length-${row.cableId}`} className="flex-shrink-0 tabular-nums text-right">
              {row.lengthWithSpare !== null ? (
                <span className="text-neutral-800">{formatMeters(row.lengthWithSpare.nominal)}</span>
              ) : (
                <span className="font-medium text-amber-700">{row.unestimatedReason}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] leading-tight text-neutral-400">
        Length incl. {sparePercent}% spare. Totals above are rounded once on the sum.
      </p>
    </div>
  )
}
