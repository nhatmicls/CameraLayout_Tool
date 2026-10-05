import type { ManufacturerDori } from '../catalog/camera-catalog-loader'
import { isApproximateDoriModel, type DoriDistancesM } from '../domain/dori-zone-distance-calculator'

interface CameraDoriDistanceTableProps {
  computed: DoriDistancesM
  effectiveHfovDeg: number
  manufacturerDori: ManufacturerDori | null
}

const ZONE_LABELS: ReadonlyArray<{ key: keyof DoriDistancesM; label: string }> = [
  { key: 'identify', label: 'Identify' },
  { key: 'recognize', label: 'Recognize' },
  { key: 'observe', label: 'Observe' },
  { key: 'detect', label: 'Detect' },
]

/** Formats a metre distance to 1 decimal place. */
function formatM(value: number): string {
  return `${value.toFixed(1)} m`
}

/**
 * The computed DORI distance table for a selected camera, with the
 * manufacturer's printed DORI shown alongside (when the catalog record has
 * one) labelled "datasheet (reference)" so it reads as a cross-check, not a
 * contradiction - wide lenses can differ a lot from the computed value.
 */
export function CameraDoriDistanceTable({ computed, effectiveHfovDeg, manufacturerDori }: CameraDoriDistanceTableProps) {
  const approximate = isApproximateDoriModel(effectiveHfovDeg)

  return (
    <div data-testid="properties-dori-table">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-neutral-400">
            <th className="pb-1 font-normal">Zone</th>
            <th className="pb-1 font-normal">Computed</th>
            {manufacturerDori && <th className="pb-1 font-normal">Datasheet (reference)</th>}
          </tr>
        </thead>
        <tbody>
          {ZONE_LABELS.map(({ key, label }) => (
            <tr key={key} data-testid={`properties-dori-row-${key}`} className="border-t border-neutral-100">
              <td className="py-0.5 text-neutral-600">{label}</td>
              <td data-testid={`properties-dori-computed-${key}`} className="py-0.5 font-medium text-neutral-900">
                {formatM(computed[key])}
              </td>
              {manufacturerDori && (
                <td data-testid={`properties-dori-manufacturer-${key}`} className="py-0.5 text-neutral-500">
                  {formatM(manufacturerDori[key])}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {approximate && (
        <p data-testid="properties-dori-approximate-note" className="mt-1 text-[11px] text-amber-600">
          Approximate: arc-length model used for HFOV &ge; 180&deg;.
        </p>
      )}
    </div>
  )
}
