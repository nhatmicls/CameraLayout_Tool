import { useState, type KeyboardEvent } from 'react'
import { FLOOR_NAME_MAX_LENGTH, type Floor } from '../../domain/floor/floor-types'
import { useProjectStore } from '../../state/project-store'

interface FloorTabItemProps {
  floor: Floor
  /** 0-based position in `floors` - tab 1 (lowest floor) is index 0. */
  index: number
  isActive: boolean
  onSelect: () => void
}

const tabButtonClass =
  'rounded px-2 py-1 text-sm font-medium transition-colors focus:outline focus:outline-2 focus:outline-blue-600'

/**
 * One floor tab's IDENTITY only (M3: move/delete/height controls moved out
 * to `floor-active-tab-controls.tsx`, a sibling OUTSIDE the `role="tablist"`
 * container - ARIA expects a tablist's children to be tabs, nothing else).
 *
 * Click to switch. Rename (any tab, active or not), three ways: double-click
 * the label, or focus it and press F2, or press Enter while it is already
 * the active tab (Enter on an inactive tab just selects it, matching normal
 * tab behaviour). Enter commits, Esc cancels, trimmed, empty reverts.
 * ArrowLeft/ArrowRight move focus - and selection - to the neighbouring tab
 * (the common "automatic activation" `tablist` keyboard pattern).
 */
export function FloorTabItem({ floor, index, isActive, onSelect }: FloorTabItemProps) {
  const renameFloor = useProjectStore((s) => s.renameFloor)

  const [isRenaming, setIsRenaming] = useState(false)
  const [draftName, setDraftName] = useState(floor.name)

  const startRename = () => {
    setDraftName(floor.name)
    setIsRenaming(true)
  }
  const commitRename = () => {
    setIsRenaming(false)
    const trimmed = draftName.trim()
    if (trimmed.length > 0 && trimmed !== floor.name) renameFloor(floor.id, trimmed)
  }
  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename()
    else if (e.key === 'Escape') setIsRenaming(false)
  }

  const navigateToNeighbourTab = (direction: -1 | 1, from: HTMLButtonElement) => {
    const tablist = from.closest('[role="tablist"]')
    const tabs = tablist ? Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]')) : []
    const currentIndex = tabs.indexOf(from)
    if (currentIndex === -1) return
    const target = tabs[currentIndex + direction]
    if (!target) return
    target.focus()
    target.click()
  }

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'F2' || (e.key === 'Enter' && isActive)) {
      e.preventDefault()
      startRename()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      navigateToNeighbourTab(e.key === 'ArrowLeft' ? -1 : 1, e.currentTarget)
    }
  }

  return (
    <div data-testid={`floor-tab-${index}`}>
      {isRenaming ? (
        <input
          autoFocus
          aria-label={`Rename floor "${floor.name}"`}
          data-testid="floor-tab-rename-input"
          value={draftName}
          maxLength={FLOOR_NAME_MAX_LENGTH}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeyDown}
          className="w-28 rounded border border-blue-400 px-1.5 py-1 text-sm"
        />
      ) : (
        <button
          type="button"
          role="tab"
          aria-selected={isActive}
          data-testid={`floor-tab-button-${index}`}
          onClick={onSelect}
          onDoubleClick={startRename}
          onKeyDown={handleTabKeyDown}
          title="Double-click, or press F2, to rename"
          className={`${tabButtonClass} ${isActive ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
        >
          F{index + 1} {floor.name}
        </button>
      )}
    </div>
  )
}
