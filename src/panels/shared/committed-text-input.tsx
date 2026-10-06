import { useState, type KeyboardEvent } from 'react'

interface CommittedTextInputProps {
  id: string
  testId: string
  value: string
  maxLength: number
  className?: string
  ariaLabel?: string
  onCommit: (value: string) => void
}

/**
 * Text field that commits on blur or Enter (one undo step per rename, not
 * one per keystroke). The committed text is trimmed; an empty or unchanged
 * entry reverts without calling `onCommit`. Esc drops the draft.
 */
export function CommittedTextInput({ id, testId, value, maxLength, className, ariaLabel, onCommit }: CommittedTextInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const trimmed = draft.trim().slice(0, maxLength)
    setDraft(null)
    if (trimmed !== '' && trimmed !== value) onCommit(trimmed)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') setDraft(null)
  }

  return (
    <input
      id={id}
      data-testid={testId}
      type="text"
      aria-label={ariaLabel}
      maxLength={maxLength}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={className}
    />
  )
}
