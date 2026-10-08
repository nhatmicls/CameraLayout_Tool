import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import type { CompatibilityWarning } from '../../domain/fire-alarm/fire-alarm-compatibility-checker'
import { fireAlarmBomNoControllerPlacedLine, fireAlarmBomNotListedWarningLine, FIRE_COMPATIBILITY_WARNINGS_HEADING } from './fire-alarm-ui-wording'

interface FireAlarmCompatibilityWarningsBlockProps {
  warnings: readonly CompatibilityWarning[]
  /** Resolves a device id to the SAME label text its BOM row uses (H3 review fix - "one label function"); `null` drops that device from its line (not currently in the caller's view). */
  labelFor: (deviceId: string) => string | null
  /** Whether clicking this device's line should select it - false when it lives on a floor other than the one active on the canvas (its properties panel could not show anyway). */
  isSelectable: (deviceId: string) => boolean
  onSelectDevice: (deviceId: string) => void
}

interface WarningLine {
  key: string
  /** The device a click selects - the aggregated `no-controller-placed` line picks its first id, same as before this fix. */
  deviceId: string
  text: string
}

function buildLines(warnings: readonly CompatibilityWarning[], labelFor: (deviceId: string) => string | null): WarningLine[] {
  return warnings.flatMap((warning): WarningLine[] => {
    if (warning.code === 'not-listed-for-placed-controllers') {
      const label = labelFor(warning.deviceId)
      if (label === null) return []
      const modelName = fireAlarmModelSpecById[warning.modelId]?.model ?? warning.modelId
      return [{ key: warning.deviceId, deviceId: warning.deviceId, text: fireAlarmBomNotListedWarningLine(label, modelName) }]
    }
    const labels = warning.deviceIds.map(labelFor).filter((label): label is string => label !== null)
    if (labels.length === 0) return []
    return [{ key: 'no-controller-placed', deviceId: warning.deviceIds[0], text: fireAlarmBomNoControllerPlacedLine(labels.join(', ')) }]
  })
}

/**
 * BOM-panel block below the tables, listing every fire-alarm compatibility
 * warning: one line per `not-listed-for-placed-controllers` device, one
 * aggregated line for `no-controller-placed`. Renders nothing when there
 * are no warnings (or, once every named device falls outside the caller's
 * current view, `labelFor` drops them all). A line for a device not on the
 * active canvas floor renders as plain (non-clickable) text with a hint -
 * the simpler choice over switching floors first (H3 review). Wording here
 * must agree with the row's own `notes`/the PNG legend: "not listed", never
 * "incompatible".
 */
export function FireAlarmCompatibilityWarningsBlock({ warnings, labelFor, isSelectable, onSelectDevice }: FireAlarmCompatibilityWarningsBlockProps) {
  const lines = buildLines(warnings, labelFor)
  if (lines.length === 0) return null

  return (
    <div data-testid="bom-fire-alarm-warnings" className="mt-3 border-t border-amber-200 pt-2">
      <h3 className="text-xs font-semibold text-amber-700">{FIRE_COMPATIBILITY_WARNINGS_HEADING}</h3>
      <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
        {lines.map((line) => (
          <li key={line.key}>
            {isSelectable(line.deviceId) ? (
              <button
                type="button"
                data-testid={`bom-fire-alarm-warning-${line.key}`}
                onClick={() => onSelectDevice(line.deviceId)}
                className="text-left hover:underline"
              >
                {line.text}
              </button>
            ) : (
              <span data-testid={`bom-fire-alarm-warning-${line.key}`} title="On another floor - switch to it to select this device">
                {line.text}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
