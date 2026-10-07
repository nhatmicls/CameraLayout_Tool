import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { fireAlarmBomNoControllerPlacedLine, fireAlarmBomNotListedWarningLine, FIRE_COMPATIBILITY_WARNINGS_HEADING } from './fire-alarm-ui-wording'

interface FireAlarmCompatibilityWarningsBlockProps {
  devices: readonly PlacedFireAlarmDevice[]
  /** From `checkFireAlarmCompatibility`, already computed once for the BOM rows' `notes` (`build-combined-bom-rows.ts`) - never recomputed here. */
  warnings: readonly CompatibilityWarning[]
}

/** 1-based "F{n}" label for a device id's position in `devices`. */
function labelFor(deviceId: string, devices: readonly PlacedFireAlarmDevice[]): string {
  return `F${devices.findIndex((d) => d.id === deviceId) + 1}`
}

/**
 * BOM-panel block below the tables, listing every fire-alarm compatibility
 * warning: one line per `not-listed-for-placed-controllers` device, one
 * aggregated line for `no-controller-placed`. Renders nothing when there
 * are no warnings. Clicking a line selects that device (its properties
 * panel shows the matching status line, phase 7) - wording here must agree
 * with that line: "not listed", never "incompatible".
 */
export function FireAlarmCompatibilityWarningsBlock({ devices, warnings }: FireAlarmCompatibilityWarningsBlockProps) {
  const setSelectedFireAlarmDeviceId = useEditorUiStore((s) => s.setSelectedFireAlarmDeviceId)
  if (warnings.length === 0) return null

  const rows = warnings.map((warning) =>
    warning.code === 'not-listed-for-placed-controllers'
      ? {
          key: warning.deviceId,
          deviceId: warning.deviceId,
          text: fireAlarmBomNotListedWarningLine(
            labelFor(warning.deviceId, devices),
            fireAlarmModelSpecById[warning.modelId]?.model ?? warning.modelId,
          ),
        }
      : {
          key: 'no-controller-placed',
          deviceId: warning.deviceIds[0],
          text: fireAlarmBomNoControllerPlacedLine(warning.deviceIds.map((id) => labelFor(id, devices)).join(', ')),
        },
  )

  return (
    <div data-testid="bom-fire-alarm-warnings" className="mt-3 border-t border-amber-200 pt-2">
      <h3 className="text-xs font-semibold text-amber-700">{FIRE_COMPATIBILITY_WARNINGS_HEADING}</h3>
      <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              data-testid={`bom-fire-alarm-warning-${row.key}`}
              onClick={() => setSelectedFireAlarmDeviceId(row.deviceId)}
              className="text-left hover:underline"
            >
              {row.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
