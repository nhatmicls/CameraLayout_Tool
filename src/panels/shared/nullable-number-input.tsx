import { useState, type KeyboardEvent } from 'react'
import { parseCommittedNumber } from './committed-number-input-parser'

interface NullableNumberInputProps {
  id: string
  testId: string
  value: number | null
  min: number
  max: number
  step?: number
  /** Round to a whole number (prices). */
  integer?: boolean
  /** Default true: an empty field commits null. False: an empty field reverts (the value is required). */
  allowEmpty?: boolean
  placeholder?: string
  className?: string
  onCommit: (value: number | null) => void
}

/**
 * Number field that commits on blur or Enter, never per keystroke - every
 * commit is one undo step, so typing "8000" must not record four. While
 * focused the text is a local draft; an entry that is not a number reverts
 * to the last committed value, and an unchanged value does not call
 * `onCommit`. Because the draft only exists while editing, an undo that
 * changes `value` shows up as soon as the field is not being typed in.
 */
export function NullableNumberInput({
  id,
  testId,
  value,
  min,
  max,
  step,
  integer,
  allowEmpty = true,
  placeholder,
  className,
  onCommit,
}: NullableNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  // A number input reports "" for text it cannot parse ("8000e"); that must revert, not commit "empty".
  const [isBadInput, setIsBadInput] = useState(false)

  const dropDraft = () => {
    setDraft(null)
    setIsBadInput(false)
  }

  const commit = () => {
    if (draft === null) return
    const parsed = isBadInput ? null : parseCommittedNumber(draft, { min, max, integer, allowEmpty })
    dropDraft()
    if (parsed && parsed.value !== value) onCommit(parsed.value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') dropDraft()
  }

  return (
    <input
      id={id}
      data-testid={testId}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step ?? (integer ? 1 : 'any')}
      placeholder={placeholder}
      value={draft ?? (value === null ? '' : value)}
      onChange={(e) => {
        setDraft(e.target.value)
        setIsBadInput(e.target.validity.badInput)
      }}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={className}
    />
  )
}
