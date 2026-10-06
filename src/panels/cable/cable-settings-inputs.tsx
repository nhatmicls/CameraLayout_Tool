import { CABLE_SETTINGS_BOUNDS, type CableSettings } from '../../domain/cable/cable-layout-types'
import { compactInputClass, secondaryButtonClass } from '../camera/camera-properties-form-helpers'
import { NullableNumberInput } from '../shared/nullable-number-input'

interface CableSettingsInputsProps {
  settings: CableSettings
  onChange: (patch: Partial<CableSettings>) => void
  onReset: () => void
}

const FIELDS: Array<{ key: keyof CableSettings; label: string; unit: string; step: number; help: string }> = [
  { key: 'wastePercent', label: 'Waste', unit: '%', step: 1, help: 'Added on top of every run (offcuts, re-terminations).' },
  { key: 'routeHeightM', label: 'Route height', unit: 'm', step: 0.1, help: 'Height the cables run at (ceiling or tray).' },
  { key: 'defaultDeviceHeightM', label: 'Device height', unit: 'm', step: 0.1, help: 'Used for sensors and for cameras without a mounting height.' },
  { key: 'deviceEndSlackM', label: 'Slack at device', unit: 'm', step: 0.1, help: 'Service loop left at each device.' },
  { key: 'hubEndSlackM', label: 'Slack at hub', unit: 'm', step: 0.1, help: 'Service loop left at the hub / rack.' },
  { key: 'clickErrorPx', label: 'Scale click error', unit: 'px', step: 1, help: 'How far off each scale click may be; sets the min-max range.' },
]

/**
 * The six estimate allowances, each bounded by `CABLE_SETTINGS_BOUNDS` (the
 * same bounds the project file enforces) and committed on blur / Enter, so
 * one edit is one undo step.
 */
export function CableSettingsInputs({ settings, onChange, onReset }: CableSettingsInputsProps) {
  return (
    <div className="mt-1">
      {FIELDS.map(({ key, label, unit, step, help }) => (
        <div key={key} className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`cable-setting-${key}`} className="text-xs font-medium text-neutral-600">
              {label} ({unit})
            </label>
            <NullableNumberInput
              id={`cable-setting-${key}`}
              testId={`cable-setting-${key}`}
              value={settings[key]}
              min={CABLE_SETTINGS_BOUNDS[key].min}
              max={CABLE_SETTINGS_BOUNDS[key].max}
              step={step}
              allowEmpty={false}
              onCommit={(value) => {
                if (value !== null) onChange({ [key]: value })
              }}
              className={`w-20 text-right ${compactInputClass}`}
            />
          </div>
          <p className="text-[10px] leading-tight text-neutral-400">{help}</p>
        </div>
      ))}
      <button type="button" data-testid="cable-settings-reset-button" onClick={onReset} className={`mt-2 ${secondaryButtonClass}`}>
        Reset to defaults
      </button>
    </div>
  )
}
