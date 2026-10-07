import { useMemo } from 'react'
import { cameraFormFactorOf } from '../../catalog/camera/camera-catalog-loader'
import { sensorKindOf } from '../../catalog/sensor/sensor-catalog-loader'
import { countPlanItemsForView, viewToggleItemCount } from '../../domain/view/plan-view-item-counts'
import {
  VIEW_TOGGLES,
  VIEW_TOGGLE_GROUP_LABELS,
  countHiddenViewToggles,
  isViewToggleOn,
  isViewTypeToggle,
  viewToggleSetState,
  withViewToggle,
  withViewToggleSet,
  type ViewToggleDefinition,
  type ViewToggleGroup,
} from '../../domain/view/view-config-toggle-table'
import { resolveEffectiveViewConfig } from '../../domain/view/view-config-tool-mode-overrides'
import { DEFAULT_VIEW_CONFIG } from '../../domain/view/view-config-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { secondaryButtonClass } from '../camera/camera-properties-form-helpers'

const GROUP_ORDER: readonly ViewToggleGroup[] = ['cameras', 'sensors', 'cabling', 'walls']

/** Label of the parent checkbox over a group's type rows (form factors / sensor kinds). Groups without type rows have none. */
const TYPE_PARENT_LABELS: Partial<Record<ViewToggleGroup, string>> = { cameras: 'Types', sensors: 'Kinds' }

/**
 * Right-aside "View" section (collapsed by default): one checkbox per view
 * toggle, each with a live count of the items it governs. All 16 rows are
 * always listed, also with zero items (muted, still toggleable), so the
 * layout never jumps. Rows, labels and the "N hidden" badge come from
 * `VIEW_TOGGLES`.
 *
 * Tree: a group with several rows has a parent checkbox on its heading, and
 * its type rows (form factors / sensor kinds) sit under their own parent
 * ("Types" / "Kinds") - a type off hides the marker AND the cone / coverage,
 * so those rows are siblings of "Markers" / "FOV cones", not their children.
 * A parent is ticked when every row under it is on, empty when all are off,
 * indeterminate for a mix; clicking it sets every row under it (a mixed
 * parent turns all on).
 *
 * The checkboxes show the STORED config - a drawing tool may force a layer
 * on meanwhile, which the hint line says. Toggling is UI-only: no undo step,
 * no unsaved-changes flag.
 */
export function ViewConfigPanel() {
  const viewConfig = useEditorUiStore((s) => s.viewConfig)
  const setViewConfig = useEditorUiStore((s) => s.setViewConfig)
  const toolMode = useEditorUiStore((s) => s.toolMode)
  const cameras = useProjectStore((s) => s.cameras)
  const sensors = useProjectStore((s) => s.sensors)
  const hubs = useProjectStore((s) => s.hubs)
  const cables = useProjectStore((s) => s.cables)
  const walls = useProjectStore((s) => s.walls)

  const counts = useMemo(
    () => countPlanItemsForView({ cameras, sensors, hubs, cables, walls }, cameraFormFactorOf, sensorKindOf),
    [cameras, sensors, hubs, cables, walls],
  )

  const hiddenCount = countHiddenViewToggles(viewConfig)
  const toolForcesSomething = resolveEffectiveViewConfig(viewConfig, toolMode) !== viewConfig

  const renderRow = (toggle: ViewToggleDefinition) => {
    const count = viewToggleItemCount(counts, toggle.key)
    return (
      <label key={toggle.id} className={`flex items-center gap-1.5 text-xs ${count === 0 ? 'text-neutral-400' : 'text-neutral-700'}`}>
        <input
          type="checkbox"
          data-testid={`view-toggle-${toggle.id}`}
          checked={isViewToggleOn(viewConfig, toggle.key)}
          onChange={(e) => setViewConfig(withViewToggle(viewConfig, toggle.key, e.target.checked))}
        />
        <span>
          {toggle.panelLabel} ({count})
        </span>
      </label>
    )
  }

  /** Tri-state parent checkbox over `toggles`. */
  const renderParent = (testId: string, label: string, toggles: readonly ViewToggleDefinition[], className: string) => {
    const state = viewToggleSetState(viewConfig, toggles)
    return (
      <label className={`flex items-center gap-1.5 text-xs ${className}`}>
        <input
          type="checkbox"
          data-testid={testId}
          checked={state === 'all'}
          // `indeterminate` is a DOM property, not an attribute: set it on the node.
          ref={(input) => {
            if (input) input.indeterminate = state === 'some'
          }}
          onChange={() => setViewConfig(withViewToggleSet(viewConfig, toggles, state !== 'all'))}
        />
        {label}
      </label>
    )
  }

  return (
    <details data-testid="view-config-panel" className="mb-3 border-b border-neutral-200 pb-3">
      <summary className="cursor-pointer select-none text-sm font-semibold text-neutral-700">
        View
        {hiddenCount > 0 && (
          <span data-testid="view-config-hidden-badge" className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal text-amber-800">
            {hiddenCount} hidden
          </span>
        )}
      </summary>

      {GROUP_ORDER.map((group) => {
        const toggles = VIEW_TOGGLES.filter((toggle) => toggle.group === group)
        const typeRows = toggles.filter(isViewTypeToggle)
        const typeParentLabel = TYPE_PARENT_LABELS[group]
        const hasParent = toggles.length > 1 // a one-row group (Walls) needs no parent checkbox
        const headingClass = 'font-semibold text-neutral-600'
        return (
          <div key={group} className="mt-2">
            {hasParent ? (
              renderParent(`view-group-toggle-${group}`, VIEW_TOGGLE_GROUP_LABELS[group], toggles, headingClass)
            ) : (
              <h3 className={`text-xs ${headingClass}`}>{VIEW_TOGGLE_GROUP_LABELS[group]}</h3>
            )}
            <div className={`mt-1 space-y-1 ${hasParent ? 'pl-4' : ''}`}>
              {toggles.filter((toggle) => !isViewTypeToggle(toggle)).map(renderRow)}
              {typeParentLabel && renderParent(`view-type-toggle-${group}`, typeParentLabel, typeRows, 'text-neutral-700')}
            </div>
            {typeRows.length > 0 && <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 pl-8">{typeRows.map(renderRow)}</div>}
          </div>
        )
      })}

      {/* Always rendered (disabled when nothing is hidden): a button that appears / disappears makes everything below it jump on each toggle. */}
      <button
        type="button"
        data-testid="view-config-show-all"
        disabled={hiddenCount === 0}
        className={`mt-2 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent ${secondaryButtonClass}`}
        onClick={() => setViewConfig(DEFAULT_VIEW_CONFIG)}
      >
        Show all
      </button>
      {toolForcesSomething && <p className="mt-2 text-[10px] text-neutral-500">The active drawing tool shows the layers it needs while it is on.</p>}
      <p className="mt-2 text-[10px] text-neutral-500">
        Hidden items stay in the BOM, CSV and cable estimate. PNG export draws what is shown.
      </p>
    </details>
  )
}
