interface CameraUnknownModelNoticeProps {
  /** Camera number label, e.g. "C3". */
  label: string
  modelId: string
  onDelete: () => void
}

/**
 * Properties-panel body for a camera whose model is no longer in the catalog
 * (e.g. loaded from an older project file after a catalog change): nothing
 * can be computed for it, but it can still be deleted.
 */
export function CameraUnknownModelNotice({ label, modelId, onDelete }: CameraUnknownModelNoticeProps) {
  return (
    <div data-testid="properties-panel" className="text-sm">
      <h2 className="text-sm font-semibold text-neutral-700">
        Properties <span className="text-neutral-400">({label})</span>
      </h2>
      <p data-testid="properties-unknown-model-note" className="mt-2 text-xs text-amber-700">
        This camera&apos;s model (&quot;{modelId}&quot;) is no longer in the catalog. Its data can still be deleted.
      </p>
      <button
        type="button"
        data-testid="properties-delete-button"
        onClick={onDelete}
        className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline focus:outline-2 focus:outline-red-800"
      >
        Delete camera
      </button>
    </div>
  )
}
