import type { ComponentType } from 'react'
import { useProjectStore } from '../../state/project-store'
import { selectScale } from '../../state/project-store-floor-selectors'
import { useCatalogSidebarFilterStore, type CatalogTab } from '../../state/catalog-sidebar-filter-store'
import { CameraCatalogList } from '../camera/camera-catalog-list'
import { SensorCatalogList } from '../sensor/sensor-catalog-list'
import { FireAlarmCatalogList } from '../fire-alarm/fire-alarm-catalog-list'
import { ControlPanelCatalogList } from '../fire-alarm/control-panel-catalog-list'
import { DoriLegend } from '../camera/dori-legend'
import { SensorCoverageLegend } from '../sensor/sensor-coverage-legend'
import { SIDEBAR_MAX_WIDTH_PX, SIDEBAR_MIN_WIDTH_PX, useResizableSidebarWidth } from './use-resizable-sidebar-width'

const TABS: ReadonlyArray<{ tab: CatalogTab; label: string }> = [
  { tab: 'cameras', label: 'Cameras' },
  { tab: 'sensors', label: 'Sensors' },
  { tab: 'fire-alarm', label: 'Fire alarm' },
  { tab: 'control-panel', label: 'Control panel' },
]

// Lookup objects (not nested ternaries) for the tab's list body and footer legend - the
// fire-alarm and control-panel tabs have no footer legend (their markers have no colour-
// coded bands to key, unlike DORI/sensor kinds), so those slots are null.
const TAB_LIST: Record<CatalogTab, ComponentType<{ disabled: boolean }>> = {
  cameras: CameraCatalogList,
  sensors: SensorCatalogList,
  'fire-alarm': FireAlarmCatalogList,
  'control-panel': ControlPanelCatalogList,
}

const TAB_LEGEND: Record<CatalogTab, ComponentType | null> = {
  cameras: DoriLegend,
  sensors: SensorCoverageLegend,
  'fire-alarm': null,
  'control-panel': null,
}

/**
 * Left sidebar shell: the Cameras/Sensors/Fire alarm tab switch, the
 * disabled-until-scale hint (shared by all three tabs - none of a camera
 * cone, a sensor's metre-based coverage or a fire detector's TCVN circle
 * means anything before the plan is calibrated), the active tab's catalog
 * list, and a footer legend that swaps with the tab (`TAB_LIST`/`TAB_LEGEND`
 * lookups, not nested ternaries - the fire-alarm tab has no legend).
 */
export function CatalogSidebar() {
  const scale = useProjectStore(selectScale)
  const catalogTab = useCatalogSidebarFilterStore((s) => s.catalogTab)
  const setCatalogTab = useCatalogSidebarFilterStore((s) => s.setCatalogTab)

  const { widthPx, handleProps } = useResizableSidebarWidth()

  const disabled = scale === null
  const TabList = TAB_LIST[catalogTab]
  const TabLegend = TAB_LEGEND[catalogTab]

  return (
    <aside
      style={{ width: widthPx }}
      className="relative flex flex-shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize catalog panel"
        aria-valuenow={widthPx}
        aria-valuemin={SIDEBAR_MIN_WIDTH_PX}
        aria-valuemax={SIDEBAR_MAX_WIDTH_PX}
        tabIndex={0}
        title="Drag to resize - double-click to reset"
        data-testid="catalog-sidebar-resize-handle"
        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-blue-400/50 focus-visible:bg-blue-400/50 focus-visible:outline-none"
        {...handleProps}
      />
      {/* Stable scrollbar gutter: the content width (and so the tab labels' wrapping) must not
          change when a long catalog list makes the scrollbar appear. */}
      <div className="flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable]">
        {/* Fixed 4-column grid, not flex-wrap: the row never re-wraps (4 vs 3 + 1). */}
        <div className="grid grid-cols-4 gap-1" role="tablist">
          {TABS.map(({ tab, label }) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={catalogTab === tab}
              data-testid={`catalog-tab-${tab}`}
              onClick={() => setCatalogTab(tab)}
              className={`rounded px-1 py-1.5 text-[11px] font-semibold leading-tight transition-colors ${
                catalogTab === tab ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {disabled && (
          <p data-testid="catalog-disabled-hint" className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            Set the scale first (toolbar &rarr; &quot;Set scale&quot;) to unlock the catalog.
          </p>
        )}

        <TabList disabled={disabled} />
      </div>

      {TabLegend && <TabLegend />}
    </aside>
  )
}
