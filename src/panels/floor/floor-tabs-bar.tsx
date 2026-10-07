import { MAX_FLOORS } from '../../domain/floor/floor-types'
import { useProjectStore } from '../../state/project-store'
import { FloorActiveTabControls } from './floor-active-tab-controls'
import { FloorTabItem } from './floor-tab-item'

/**
 * Floor tab bar under the toolbar: one tab per floor in order (tab 1 = the
 * lowest floor - riser/shaft links go to the next tab up), the ACTIVE
 * floor's move/delete/height controls, and "+" to add a floor at the end
 * (becomes active immediately, disabled at `MAX_FLOORS`). Always rendered,
 * even for a brand-new one-floor project, so the floor concept is visible
 * from the start.
 *
 * M3: only the tab buttons themselves sit inside `role="tablist"` - ARIA
 * expects a tablist's children to be tabs, nothing else, so the active
 * floor's own controls and "+ Floor" are siblings of it, not nested in it.
 */
export function FloorTabsBar() {
  const floors = useProjectStore((s) => s.floors)
  const activeFloorId = useProjectStore((s) => s.activeFloorId)
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor)
  const addFloor = useProjectStore((s) => s.addFloor)

  const atMax = floors.length >= MAX_FLOORS

  return (
    <div className="flex min-h-9 flex-shrink-0 flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-3 py-1">
      <div role="tablist" aria-label="Floors" data-testid="floor-tabs-bar" className="flex flex-wrap items-center gap-1">
        {floors.map((floor, index) => (
          <FloorTabItem key={floor.id} floor={floor} index={index} isActive={floor.id === activeFloorId} onSelect={() => setActiveFloor(floor.id)} />
        ))}
      </div>

      <FloorActiveTabControls />

      <button
        type="button"
        data-testid="floor-tab-add-button"
        onClick={() => addFloor()}
        disabled={atMax}
        title={atMax ? `Maximum ${MAX_FLOORS} floors` : 'Add a floor'}
        className="rounded px-2 py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent focus:outline focus:outline-2 focus:outline-blue-600"
      >
        + Floor
      </button>
    </div>
  )
}
