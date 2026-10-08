import { useEffect, useRef, useState } from 'react'
import type { Floor } from '../../domain/floor/floor-types'

interface ShaftFloorRangeDialogProps {
  floors: Floor[]
  defaultName: string
  onCancel: () => void
  onConfirm: (name: string, fromFloorIndex: number, toFloorIndex: number) => void
}

/**
 * Modal shown right after clicking the plan with the "Shaft" tool: names the
 * new shaft and picks which floors it opens onto (default the whole
 * building, lowest to highest). Confirming creates one marker on every
 * floor in range that has an image and room for one more hub - the caller
 * (`floor-plan-stage.tsx`) reports any skipped floors afterwards.
 */
export function ShaftFloorRangeDialog({ floors, defaultName, onCancel, onConfirm }: ShaftFloorRangeDialogProps) {
  const [name, setName] = useState(defaultName)
  const [fromIndex, setFromIndex] = useState(0)
  const [toIndex, setToIndex] = useState(floors.length - 1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    onConfirm(trimmed, fromIndex, toIndex)
  }

  // C2 fix: preview the SAME "no eligible floor" check the store action itself refuses on, so the
  // button is disabled before the user even submits, instead of a refusal appearing only after.
  const lo = Math.min(fromIndex, toIndex)
  const hi = Math.max(fromIndex, toIndex)
  const hasEligibleFloorInRange = floors.some((floor, i) => i >= lo && i <= hi && floor.image !== null)
  const canSubmit = name.trim().length > 0 && hasEligibleFloorInRange

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="shaft-range-dialog-title"
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 id="shaft-range-dialog-title" className="text-base font-semibold text-neutral-900">
          New shaft
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Creates an opening at this point on every floor in the range. Drag each one into place afterwards - plans are not always aligned.
        </p>

        <label htmlFor="shaft-name-input" className="mt-4 block text-sm font-medium text-neutral-700">
          Name
        </label>
        <input
          id="shaft-name-input"
          data-testid="shaft-range-name-input"
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline focus:outline-2 focus:outline-blue-600"
        />

        <div className="mt-3 flex gap-2">
          <label className="flex-1 text-sm text-neutral-700">
            From floor
            <select
              data-testid="shaft-range-from-select"
              value={fromIndex}
              onChange={(e) => setFromIndex(Number(e.target.value))}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {floors.map((floor, i) => (
                <option key={floor.id} value={i}>
                  {floor.image ? floor.name : `${floor.name} (no plan image)`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-sm text-neutral-700">
            To floor
            <select
              data-testid="shaft-range-to-select"
              value={toIndex}
              onChange={(e) => setToIndex(Number(e.target.value))}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            >
              {floors.map((floor, i) => (
                <option key={floor.id} value={i}>
                  {floor.image ? floor.name : `${floor.name} (no plan image)`}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!hasEligibleFloorInRange && (
          <p data-testid="shaft-range-no-eligible-floor" className="mt-2 text-xs text-amber-600">
            No floor in this range has a plan image yet - pick a different range.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="shaft-range-cancel-button"
            onClick={onCancel}
            className="rounded px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus:outline focus:outline-2 focus:outline-blue-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="shaft-range-confirm-button"
            disabled={!canSubmit}
            title={hasEligibleFloorInRange ? undefined : 'No floor in this range has a plan image yet.'}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-300 focus:outline focus:outline-2 focus:outline-blue-800"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
