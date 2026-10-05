import type { WallKind } from '../domain/project-types'
import { useEditorUiStore } from '../state/editor-ui-store'
import { useProjectStore } from '../state/project-store'

interface WallToolControlsProps {
  hasImage: boolean
  /** The toolbar's shared button styling, passed in so the two stay identical. */
  buttonClass: string
}

const WALL_KIND_OPTIONS: Array<{ kind: WallKind; label: string; title: string }> = [
  { kind: 'opaque', label: 'Opaque', title: 'Blocks camera view' },
  { kind: 'glass', label: 'Glass', title: 'See-through: drawn for reference, never blocks a camera' },
]

const DRAW_WALLS_HINT = 'Click to add points. Double-click or Esc to finish. Drag to pan. Leave gaps for doors.'

/**
 * Toolbar group for walls: the "Draw walls" mode toggle, the Opaque / Glass
 * choice and "Delete wall". Store-connected so the toolbar only has to mount
 * it. The kind choice edits the selected wall when there is one, otherwise
 * it sets the kind of the walls drawn next; it is hidden when neither applies.
 */
export function WallToolControls({ hasImage, buttonClass }: WallToolControlsProps) {
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  const wallDrawKind = useEditorUiStore((s) => s.wallDrawKind)
  const setWallDrawKind = useEditorUiStore((s) => s.setWallDrawKind)
  const selectedWallId = useEditorUiStore((s) => s.selectedWallId)
  const setSelectedWallId = useEditorUiStore((s) => s.setSelectedWallId)
  const setSelectedCameraId = useEditorUiStore((s) => s.setSelectedCameraId)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  // Looked up rather than trusted: an undo can remove the wall while its id is still selected.
  const selectedWall = useProjectStore((s) => (selectedWallId ? (s.walls.find((w) => w.id === selectedWallId) ?? null) : null))
  const updateWall = useProjectStore((s) => s.updateWall)
  const deleteWall = useProjectStore((s) => s.deleteWall)

  const isDrawing = toolMode === 'wall'
  const activeKind = selectedWall?.kind ?? wallDrawKind

  const handleToggleDrawing = () => {
    if (isDrawing) {
      setToolMode('select')
      return
    }
    setSelectedCameraId(null)
    setSelectedWallId(null)
    setToolMode('wall')
    pushNotification('info', DRAW_WALLS_HINT)
  }

  const handleKindChange = (kind: WallKind) => {
    if (!selectedWall) setWallDrawKind(kind)
    else if (selectedWall.kind !== kind) updateWall(selectedWall.id, { kind }) // same kind: no undo step, no re-clip
  }

  const handleDeleteWall = () => {
    if (!selectedWall) return
    deleteWall(selectedWall.id)
    setSelectedWallId(null)
  }

  return (
    <>
      <button
        type="button"
        data-testid="draw-walls-button"
        onClick={handleToggleDrawing}
        disabled={!hasImage}
        aria-pressed={isDrawing}
        title={hasImage ? DRAW_WALLS_HINT : 'Load a floor plan first'}
        className={`${buttonClass} ${isDrawing ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
      >
        Draw walls
      </button>

      {(isDrawing || selectedWall) && (
        <div role="group" aria-label={selectedWall ? 'Selected wall' : 'New walls'} className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">{selectedWall ? 'Selected wall' : 'New walls'}</span>
          {WALL_KIND_OPTIONS.map(({ kind, label, title }) => (
            <button
              key={kind}
              type="button"
              data-testid={`wall-kind-${kind}-button`}
              onClick={() => handleKindChange(kind)}
              aria-pressed={activeKind === kind}
              title={title}
              className={`${buttonClass} ${activeKind === kind ? 'bg-neutral-200' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {selectedWall && (
        <button type="button" data-testid="delete-wall-button" onClick={handleDeleteWall} title="Delete wall (Del)" className={buttonClass}>
          Delete wall
        </button>
      )}
    </>
  )
}
