import { useState, type DragEvent } from 'react'

interface EmptyStateImagePickerProps {
  onOpenFileDialog: () => void
  onFileDropped: (file: File) => void
}

/** Shown in the centre column before a floor-plan image is loaded: explains what to do, accepts a drag-and-drop file. */
export function EmptyStateImagePicker({ onOpenFileDialog, onFileDropped }: EmptyStateImagePickerProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileDropped(file)
  }

  return (
    <div
      data-testid="empty-state"
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex h-full w-full flex-col items-center justify-center gap-3 border-2 border-dashed text-center transition-colors ${
        isDragOver ? 'border-blue-500 bg-blue-50' : 'border-neutral-300 bg-neutral-50'
      }`}
    >
      <p className="text-base font-medium text-neutral-700">No floor plan loaded</p>
      <p className="max-w-sm text-sm text-neutral-500">
        Load a PNG or JPG floor-plan image to get started, or drag one onto this area.
      </p>
      <button
        type="button"
        data-testid="empty-state-load-button"
        onClick={onOpenFileDialog}
        className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline focus:outline-2 focus:outline-blue-800"
      >
        Load floor plan
      </button>
    </div>
  )
}
