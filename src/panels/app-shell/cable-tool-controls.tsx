import { useMemo } from 'react'
import { buildFloorItemLabels } from '../../domain/floor/floor-item-label-allocator'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { useEditorUiStore, type ToolMode } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectActiveFloor, selectHubs } from '../../state/project-store-floor-selectors'

interface CableToolControlsProps {
  hasImage: boolean
  /** The toolbar's shared button styling, passed in so the two stay identical. */
  buttonClass: string
}

// Kept short: the info toast overlays the top of the canvas until it clears.
const ADD_HUB_HINT = 'Click the plan to place a hub. Esc to finish.'
const ADD_RISER_HINT = 'Click where cables go up to the floor above. Esc to finish.'
const ADD_DROP_HINT = 'Click where cables go down to the floor below. Esc to finish.'
const ADD_SHAFT_HINT = 'Click the plan for the vertical tube - a dialog picks which floors it opens onto.'
const DRAW_CABLE_HINT = 'Click a device, then route points, then a hub, riser, drop or shaft (or the reverse). Backspace undoes a point, Esc cancels.'

/**
 * Toolbar group for cabling: the "Add hub", "Add riser", "Add drop" and "Draw cable" mode toggles
 * and, only while drawing cables, the type given to the next cable.
 * Store-connected so the toolbar only has to mount it.
 */
export function CableToolControls({ hasImage, buttonClass }: CableToolControlsProps) {
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const clearSelection = useEditorUiStore((s) => s.clearSelection)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const cableDrawTypeId = useEditorUiStore((s) => s.cableDrawTypeId)
  const setCableDrawTypeId = useEditorUiStore((s) => s.setCableDrawTypeId)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const selectedHubId = useEditorUiStore((s) => s.selectedHubId)
  const hubs = useProjectStore(selectHubs)
  const shafts = useProjectStore((s) => s.shafts)
  const activeFloor = useProjectStore(selectActiveFloor)
  const shaftIds = useMemo(() => shafts.map((shaft) => shaft.id), [shafts])
  const itemLabels = useMemo(
    () => buildFloorItemLabels(activeFloor, { shaftIds, fireAlarmModelById: fireAlarmModelSpecById }),
    [activeFloor, shaftIds],
  )

  // The trunk tool (`ToolMode 'trunk'`) is entered from the hub/shaft panel, not a toolbar toggle -
  // this is a status readout + a way out, not a mode button like the others.
  const startHubIndex = hubs.findIndex((hub) => hub.id === selectedHubId)
  const startHubLabel = startHubIndex >= 0 ? itemLabels.hubs[startHubIndex] : 'this point'

  // The remembered id can be stale (type deleted, project replaced): fall back to the first type.
  const drawType = cableTypes.find((type) => type.id === cableDrawTypeId) ?? cableTypes[0]

  const toggleMode = (mode: ToolMode, hint: string) => {
    if (toolMode === mode) {
      setToolMode('select')
      return
    }
    clearSelection() // so Delete / Backspace in the tool can never remove a selected item
    setToolMode(mode)
    pushNotification('info', hint)
  }

  const modeButton = (mode: ToolMode, label: string, hint: string, testId: string) => (
    <button
      type="button"
      data-testid={testId}
      onClick={() => toggleMode(mode, hint)}
      disabled={!hasImage}
      aria-pressed={toolMode === mode}
      title={hasImage ? hint : 'Load a floor plan first'}
      className={`${buttonClass} ${toolMode === mode ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
    >
      {label}
    </button>
  )

  return (
    <>
      {modeButton('hub', 'Add hub', ADD_HUB_HINT, 'add-hub-button')}
      {modeButton('riser', 'Add riser', ADD_RISER_HINT, 'add-riser-button')}
      {modeButton('drop', 'Add drop', ADD_DROP_HINT, 'add-drop-button')}
      {modeButton('shaft', 'Shaft', ADD_SHAFT_HINT, 'add-shaft-button')}
      {modeButton('cable', 'Draw cable', DRAW_CABLE_HINT, 'draw-cable-button')}

      {toolMode === 'cable' && drawType && (
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          Type
          <select
            data-testid="cable-draw-type-select"
            value={drawType.id}
            onChange={(e) => setCableDrawTypeId(e.target.value)}
            className="max-w-40 rounded border border-neutral-300 bg-white px-1 py-1 text-sm text-neutral-700"
          >
            {cableTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {toolMode === 'trunk' && (
        <>
          <span data-testid="trunk-draw-hint" className="text-xs text-neutral-500">
            {`Drawing route from ${startHubLabel} - click a hub to finish.`}
          </span>
          <button type="button" data-testid="cancel-trunk-draw-button" onClick={() => setToolMode('select')} className={buttonClass}>
            Cancel
          </button>
        </>
      )}
    </>
  )
}
