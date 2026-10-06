interface CameraUnknownModelNoticeProps {
  /** Number label, e.g. "C3" for a camera or "S2" for a sensor. */
  label: string
  modelId: string
  onDelete: () => void
  /** What to call the placed item in the message/button, e.g. "camera" or "sensor". Default "camera". */
  itemNoun?: string
}

/**
 * Properties-panel body for a placed item whose model is no longer in its
 * catalog (e.g. loaded from an older project file after a catalog change):
 * nothing can be computed for it, but it can still be deleted. Shared by
 * the camera and sensor properties panels via `itemNoun` (phase 6) - the
 * wording is the only thing that differs between the two catalogs.
 */
export function CameraUnknownModelNotice({ label, modelId, onDelete, itemNoun = 'camera' }: CameraUnknownModelNoticeProps) {
  return (
    <div data-testid="properties-panel" className="text-sm">
      <h2 className="text-sm font-semibold text-neutral-700">
        Properties <span className="text-neutral-400">({label})</span>
      </h2>
      <p data-testid="properties-unknown-model-note" className="mt-2 text-xs text-amber-700">
        This {itemNoun}&apos;s model (&quot;{modelId}&quot;) is no longer in the catalog. Its data can still be deleted.
      </p>
      <button
        type="button"
        data-testid="properties-delete-button"
        onClick={onDelete}
        className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline focus:outline-2 focus:outline-red-800"
      >
        Delete {itemNoun}
      </button>
    </div>
  )
}
