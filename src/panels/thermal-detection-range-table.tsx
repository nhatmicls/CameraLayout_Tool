import type { ThermalDriM } from '../domain/sensor-types'
import { formatM } from './camera-properties-form-helpers'

interface ThermalDetectionRangeTableProps {
  human: ThermalDriM
  /** null when the datasheet does not print a separate vehicle distance (every record does not have one). */
  vehicle: ThermalDriM | null
}

const ZONE_ROWS: ReadonlyArray<{ key: keyof ThermalDriM; label: string }> = [
  { key: 'identify', label: 'Identify' },
  { key: 'recognize', label: 'Recognize' },
  { key: 'detect', label: 'Detect' },
]

/**
 * The selected thermal sensor's printed detection-recognition-identification
 * distances, exactly as stored on the catalog record - never clipped to the
 * drawn cone's current range, never computed (CLAUDE.md: no DORI figure for
 * a sensor). A vehicle column only appears when the datasheet separates it.
 */
export function ThermalDetectionRangeTable({ human, vehicle }: ThermalDetectionRangeTableProps) {
  return (
    <div data-testid="properties-thermal-dri-table" className="mt-3">
      <h3 className="text-xs font-semibold text-neutral-700">Detection ranges</h3>
      <table className="mt-1 w-full text-left text-xs">
        <thead>
          <tr className="text-neutral-400">
            <th className="pb-1 font-normal">Zone</th>
            <th className="pb-1 font-normal">Human</th>
            {vehicle && <th className="pb-1 font-normal">Vehicle</th>}
          </tr>
        </thead>
        <tbody>
          {ZONE_ROWS.map(({ key, label }) => (
            <tr key={key} data-testid={`properties-thermal-dri-row-${key}`} className="border-t border-neutral-100">
              <td className="py-0.5 text-neutral-600">{label}</td>
              <td data-testid={`properties-thermal-dri-human-${key}`} className="py-0.5 font-medium text-neutral-900">
                {formatM(human[key])}
              </td>
              {vehicle && (
                <td data-testid={`properties-thermal-dri-vehicle-${key}`} className="py-0.5 text-neutral-700">
                  {formatM(vehicle[key])}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="properties-thermal-dri-note" className="mt-1 text-[11px] text-neutral-500">
        Datasheet detection ranges, not EN 62676-4 DORI.
      </p>
    </div>
  )
}
