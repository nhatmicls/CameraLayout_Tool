import { useState, type ChangeEvent } from 'react'
import { clamp } from '../camera/camera-properties-form-helpers'

interface ClampedNumberInputProps {
  id: string
  testId: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  className: string
  onCommit: (value: number) => void
}

/**
 * Number input bounded to [min, max]. An in-range value is committed as it
 * is typed; an out-of-range or partial one (e.g. "0" on the way to "0.7")
 * stays in a local draft and is clamped and committed on blur. Clamping on
 * every keystroke would rewrite the field mid-entry.
 */
export function ClampedNumberInput({ id, testId, value, min, max, step, disabled, className, onCommit }: ClampedNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value)
    const raw = e.target.valueAsNumber
    if (Number.isFinite(raw) && raw >= min && raw <= max) onCommit(raw)
  }

  const handleBlur = () => {
    if (draft === null) return
    const raw = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(raw)) onCommit(clamp(raw, min, max))
    setDraft(null)
  }

  return (
    <input
      id={id}
      data-testid={testId}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? value}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
    />
  )
}
