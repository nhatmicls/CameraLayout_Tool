import { useProjectStore } from '../../state/project-store'
import { SENSOR_KIND_LABELS } from '../../domain/sensor/sensor-types'
import type { ThermalDriZone } from '../../domain/sensor/thermal-dri-band-calculator'
import {
  BEAM_BLOCKED_COLOR,
  BEAM_OVER_DISTANCE_COLOR,
  SENSOR_KIND_COLORS,
  THERMAL_DRI_BAND_COLORS,
} from '../../canvas/sensor/sensor-kind-color-palette'

const KIND_LEGEND_ENTRIES: ReadonlyArray<{ kind: keyof typeof SENSOR_KIND_COLORS; color: string }> = [
  { kind: 'pir', color: SENSOR_KIND_COLORS.pir },
  { kind: 'beam', color: SENSOR_KIND_COLORS.beam },
  { kind: 'vibration', color: SENSOR_KIND_COLORS.vibration },
]

const THERMAL_LEGEND_ZONES: ReadonlyArray<{ zone: ThermalDriZone; label: string }> = [
  { zone: 'identify', label: 'Identify' },
  { zone: 'recognize', label: 'Recognize' },
  { zone: 'detect', label: 'Detect' },
]

const BEAM_STATE_ENTRIES = [
  { label: 'Over datasheet max', color: BEAM_OVER_DISTANCE_COLOR },
  { label: 'Blocked by a wall', color: BEAM_BLOCKED_COLOR },
] as const

/**
 * Sidebar footer for the Sensors tab: kind colours (pir/beam/vibration),
 * thermal's Detect/Recognize/Identify band colours, the two beam line
 * states, and the current scale - the sensor twin of `dori-legend.tsx`.
 * Colours are read-only imports from `sensor-kind-color-palette.ts`
 * (`src/canvas/**` is phase 5's ownership; this file never edits it).
 */
export function SensorCoverageLegend() {
  const scale = useProjectStore((s) => s.scale)

  return (
    <div data-testid="sensor-coverage-legend" className="border-t border-neutral-200 p-3 text-xs text-neutral-600">
      <h3 className="font-semibold text-neutral-700">Sensor legend</h3>
      <ul className="mt-1.5 flex flex-col gap-1">
        {KIND_LEGEND_ENTRIES.map(({ kind, color }) => (
          <li key={kind} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
            {SENSOR_KIND_LABELS[kind]}
          </li>
        ))}
      </ul>

      <h4 className="mt-2 font-medium text-neutral-600">Thermal (D/R/I)</h4>
      <ul className="mt-1 flex flex-col gap-1">
        {THERMAL_LEGEND_ZONES.map(({ zone, label }) => (
          <li key={zone} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: THERMAL_DRI_BAND_COLORS[zone] }} />
            {label}
          </li>
        ))}
      </ul>

      <h4 className="mt-2 font-medium text-neutral-600">Beam line</h4>
      <ul className="mt-1 flex flex-col gap-1">
        {BEAM_STATE_ENTRIES.map(({ label, color }) => (
          <li key={label} className="flex items-center gap-2">
            <span className="w-4 flex-shrink-0 border-t-2" style={{ borderColor: color }} />
            {label}
          </li>
        ))}
      </ul>

      <p className="mt-1.5 text-neutral-400">{scale ? `1 m = ${scale.planPxPerMeter.toFixed(1)} px` : 'Scale not set'}</p>
    </div>
  )
}
