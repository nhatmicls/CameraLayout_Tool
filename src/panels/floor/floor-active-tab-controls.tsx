import { describeFloorContent, floorHasPlacedContent } from '../../domain/floor/floor-content-summary'
import { FLOOR_HEIGHT_BOUNDS } from '../../domain/floor/floor-types'
import { useProjectStore } from '../../state/project-store'
import { NullableNumberInput } from '../shared/nullable-number-input'

const sideButtonClass =
  'rounded px-1.5 py-1 text-sm text-neutral-500 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent focus:outline focus:outline-2 focus:outline-blue-600'

/**
 * Move-left/right, delete and the floor-height input for the ACTIVE floor -
 * a sibling of the `role="tablist"` tab row (M3), not nested inside it:
 * these act on "whichever floor is active", not on a specific tab, so they
 * are not tabs themselves and ARIA readers should not see them as part of
 * the tablist. Renders nothing if, somehow, `activeFloorId` names no floor
 * (defensive only - every mutation clamps it).
 */
export function FloorActiveTabControls() {
  const floors = useProjectStore((s) => s.floors)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  const moveFloor = useProjectStore((s) => s.moveFloor)
  const deleteFloor = useProjectStore((s) => s.deleteFloor)
  const setFloorHeight = useProjectStore((s) => s.setFloorHeight)

  const index = floors.findIndex((floor) => floor.id === activeFloorId)
  if (index === -1) return null
  const floor = floors[index]
  const floorCount = floors.length
  const isTopFloor = index === floorCount - 1
  const showHeightInput = floorCount > 1 && !isTopFloor

  const handleDelete = () => {
    if (floorCount <= 1) return
    const hasContent = floorHasPlacedContent(floor)
    const confirmed = !hasContent || window.confirm(`Delete "${floor.name}"? This removes ${describeFloorContent(floor)}. Can be undone.`)
    if (confirmed) deleteFloor(floor.id)
  }

  return (
    <div className="flex items-center gap-0.5" data-testid="floor-active-tab-controls">
      <button
        type="button"
        aria-label="Move the active floor left"
        data-testid="floor-tab-move-left-button"
        onClick={() => moveFloor(floor.id, index - 1)}
        disabled={index === 0}
        title="Move left"
        className={sideButtonClass}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Move the active floor right"
        data-testid="floor-tab-move-right-button"
        onClick={() => moveFloor(floor.id, index + 1)}
        disabled={index === floorCount - 1}
        title="Move right"
        className={sideButtonClass}
      >
        ›
      </button>
      <button
        type="button"
        aria-label="Delete the active floor"
        data-testid="floor-tab-delete-button"
        onClick={handleDelete}
        disabled={floorCount <= 1}
        title={floorCount <= 1 ? 'A project needs at least one floor' : 'Delete this floor'}
        className={`${sideButtonClass} text-red-600 hover:bg-red-50`}
      >
        ×
      </button>

      {showHeightInput && (
        <label className="ml-1 flex items-center gap-1 text-xs text-neutral-500" htmlFor={`floor-height-input-${floor.id}`}>
          Height to next floor (m)
          <NullableNumberInput
            id={`floor-height-input-${floor.id}`}
            testId="floor-height-input"
            value={floor.floorHeightM}
            min={FLOOR_HEIGHT_BOUNDS.min}
            max={FLOOR_HEIGHT_BOUNDS.max}
            step={0.1}
            allowEmpty={false}
            onCommit={(value) => {
              if (value !== null) setFloorHeight(floor.id, value)
            }}
            className="w-16 rounded border border-neutral-300 px-1 py-1 text-sm text-neutral-700"
          />
        </label>
      )}
    </div>
  )
}
