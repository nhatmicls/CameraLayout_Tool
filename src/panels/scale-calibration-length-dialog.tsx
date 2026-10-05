import { useEffect, useMemo, useRef, useState } from 'react'
import { calibrationWarnings, type RefLine } from '../domain/scale-calibration-calculator'

interface ScaleCalibrationLengthDialogProps {
  line: RefLine
  onCancel: () => void
  onConfirm: (lengthM: number) => void
}

/** Accepts both `,` and `.` as the decimal separator (common on non-US keyboards), per the phase spec. */
function parseLengthInput(raw: string): number | null {
  const normalised = raw.trim().replace(',', '.')
  if (normalised === '') return null
  const value = Number(normalised)
  return Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Modal shown after the user draws a two-point reference line: asks for the
 * real-world length, surfaces `calibrationWarnings` from the domain layer
 * before the user commits, and reports the parsed length back to the caller
 * (which does the actual `computePlanPxPerMeter` + store update).
 */
export function ScaleCalibrationLengthDialog({ line, onCancel, onConfirm }: ScaleCalibrationLengthDialogProps) {
  const [rawValue, setRawValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const lengthM = useMemo(() => parseLengthInput(rawValue), [rawValue])
  const warnings = useMemo(() => (lengthM === null ? [] : calibrationWarnings(line, lengthM)), [line, lengthM])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (lengthM !== null) onConfirm(lengthM)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="calibration-dialog-title"
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="calibration-dialog-title" className="text-base font-semibold text-neutral-900">
          Set reference length
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the real-world distance between the two points you clicked.
        </p>

        <label htmlFor="calibration-length-input" className="mt-4 block text-sm font-medium text-neutral-700">
          Length (metres)
        </label>
        <input
          id="calibration-length-input"
          data-testid="calibration-length-input"
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={rawValue}
          onChange={(e) => setRawValue(e.target.value)}
          placeholder="e.g. 3.5"
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline focus:outline-2 focus:outline-blue-600"
        />

        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-amber-700">
            {warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="calibration-cancel-button"
            onClick={onCancel}
            className="rounded px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus:outline focus:outline-2 focus:outline-blue-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="calibration-confirm-button"
            disabled={lengthM === null}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300 focus:outline focus:outline-2 focus:outline-blue-800"
          >
            Confirm
          </button>
        </div>
      </form>
    </div>
  )
}
