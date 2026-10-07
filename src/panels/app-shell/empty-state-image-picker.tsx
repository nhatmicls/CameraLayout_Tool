import { useState, type DragEvent } from 'react'
import { useProjectStore } from '../../state/project-store'

interface EmptyStateImagePickerProps {
  onOpenFileDialog: () => void
  onFileDropped: (file: File) => void
}

/**
 * Shown in the centre column before the ACTIVE floor has a plan image:
 * explains what to do, accepts a drag-and-drop file. Names which floor it
 * is for once a project has more than one - a bare "No floor plan loaded"
 * would be ambiguous with a floor tab bar visible above it.
 */
export function EmptyStateImagePicker({ onOpenFileDialog, onFileDropped }: EmptyStateImagePickerProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const floors = useProjectStore((s) => s.floors)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  const activeIndex = floors.findIndex((floor) => floor.id === activeFloorId)
  const floorLabel = floors.length > 1 && activeIndex >= 0 ? `F${activeIndex + 1} ${floors[activeIndex].name}` : null

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
      <p className="text-base font-medium text-neutral-700">
        {floorLabel ? `No floor plan loaded for ${floorLabel}` : 'No floor plan loaded'}
      </p>
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
