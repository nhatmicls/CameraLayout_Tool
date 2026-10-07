import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface FireAlarmCompatibilityPopupRow {
  key: string
  label: string
  sourceUrl: string
  note?: string
}

interface FireAlarmCompatibilityPopupProps {
  /** e.g. "DS-PHA48-EP - Compatible devices in this catalog". */
  title: string
  rows: readonly FireAlarmCompatibilityPopupRow[]
  testId: string
  onClose: () => void
}

/**
 * Modal list of one record's compatibility entries: model (link to the
 * official source) + the entry's note (minimum firmware, receiver needed).
 * Rendered through a portal on `document.body`. React events still bubble
 * to the card through the portal, so the dialog stops click and dragstart
 * itself. While open it owns the keyboard: its capture-phase listener
 * swallows every key so the canvas shortcuts (Delete removes the selected
 * device, Esc clears the selection) cannot fire behind the modal. Closes on
 * Esc, on the Close button and on a backdrop click.
 */
export function FireAlarmCompatibilityPopup({ title, rows, testId, onClose }: FireAlarmCompatibilityPopupProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Each model links to the official Hikvision list it was read from. A device missing here is "not listed" -
          that is not proof of incompatibility.
        </p>
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto text-sm">
          {rows.map((row) => (
            <li key={row.key} className="rounded border border-neutral-200 p-2">
              <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                {row.label}
              </a>
              {row.note && <p className="mt-0.5 text-xs text-neutral-500">{row.note}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid={`${testId}-close`}
            onClick={onClose}
            autoFocus
            className="rounded px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus:outline focus:outline-2 focus:outline-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
