import {
  MOUNT_HEIGHT_MAX_M,
  MOUNT_HEIGHT_MIN_M,
  TILT_MAX_DEG,
  TILT_MIN_DEG,
} from '../domain/mounted-camera-ground-coverage-calculator'
import { fieldLabelClass, inlineInputClass, inputClass, secondaryButtonClass } from './camera-properties-form-helpers'
import { ClampedNumberInput } from './clamped-number-input'

interface CameraMountingHeightTiltInputsProps {
  /** undefined = mounting not set: only the "Set mounting" button is shown. */
  mountHeightM: number | undefined
  tiltDeg: number | undefined
  /** False for HFOV >= 180deg (fisheye): tilt has no effect on the floor coverage. */
  tiltApplicable: boolean
  onSetMounting: () => void
  onChange: (patch: { mountHeightM?: number; tiltDeg?: number }) => void
  onClear: () => void
}

/**
 * Mount height + downward tilt of the selected camera. Opt-in per camera:
 * until "Set mounting" is clicked the camera keeps its flat (height-less) cone.
 */
export function CameraMountingHeightTiltInputs({
  mountHeightM,
  tiltDeg,
  tiltApplicable,
  onSetMounting,
  onChange,
  onClear,
}: CameraMountingHeightTiltInputsProps) {
  if (mountHeightM === undefined) {
    return (
      <button type="button" data-testid="properties-mount-set-button" onClick={onSetMounting} className={`mt-3 ${secondaryButtonClass}`}>
        Set mounting height + tilt
      </button>
    )
  }

  return (
    <>
      <label className={fieldLabelClass} htmlFor="properties-mount-height-input">
        Mount height (m)
      </label>
      <div className="mt-1 flex gap-2">
        <ClampedNumberInput
          id="properties-mount-height-input"
          testId="properties-mount-height-input"
          min={MOUNT_HEIGHT_MIN_M}
          max={MOUNT_HEIGHT_MAX_M}
          step={0.1}
          value={mountHeightM}
          onCommit={(value) => onChange({ mountHeightM: value })}
          className={inlineInputClass}
        />
        <button type="button" data-testid="properties-mount-clear-button" onClick={onClear} className={`flex-shrink-0 ${secondaryButtonClass}`}>
          Clear
        </button>
      </div>

      <label className={fieldLabelClass} htmlFor="properties-mount-tilt-input">
        Tilt down from horizontal (&deg;)
      </label>
      <ClampedNumberInput
        id="properties-mount-tilt-input"
        testId="properties-mount-tilt-input"
        min={TILT_MIN_DEG}
        max={TILT_MAX_DEG}
        step={1}
        value={tiltDeg ?? TILT_MIN_DEG}
        onCommit={(value) => onChange({ tiltDeg: value })}
        disabled={!tiltApplicable}
        className={`${inputClass} disabled:bg-neutral-100 disabled:text-neutral-400`}
      />
      {!tiltApplicable && (
        <p data-testid="properties-mount-fisheye-note" className="mt-1 text-[11px] text-neutral-500">
          Tilt not applicable for fisheye (HFOV &ge; 180&deg;); coverage is a circle on the floor.
        </p>
      )}
    </>
  )
}
