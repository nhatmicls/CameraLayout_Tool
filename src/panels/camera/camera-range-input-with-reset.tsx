import { fieldLabelClass, inlineInputClass, secondaryButtonClass } from './camera-properties-form-helpers'
import { ClampedNumberInput } from '../shared/clamped-number-input'

const MIN_RANGE_M = 0.5
const MAX_RANGE_M = 500

interface CameraRangeInputWithResetProps {
  rangeM: number
  onChange: (rangeM: number) => void
  /** Restores the camera's default range (datasheet illumination range or the detect-distance fallback). */
  onReset: () => void
}

/** Coverage range of the selected camera in metres, with a reset-to-default button. */
export function CameraRangeInputWithReset({ rangeM, onChange, onReset }: CameraRangeInputWithResetProps) {
  return (
    <>
      <label className={fieldLabelClass} htmlFor="properties-range-input">
        Range (m)
      </label>
      <div className="mt-1 flex gap-2">
        <ClampedNumberInput
          id="properties-range-input"
          testId="properties-range-input"
          min={MIN_RANGE_M}
          max={MAX_RANGE_M}
          step={0.1}
          value={rangeM}
          onCommit={onChange}
          className={inlineInputClass}
        />
        <button
          type="button"
          data-testid="properties-range-reset-button"
          onClick={onReset}
          className={`flex-shrink-0 ${secondaryButtonClass}`}
        >
          Reset
        </button>
      </div>
    </>
  )
}
