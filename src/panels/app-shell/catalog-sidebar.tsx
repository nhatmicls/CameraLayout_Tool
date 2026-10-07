import type { ComponentType } from 'react'
import { useProjectStore } from '../../state/project-store'
import { useCatalogSidebarFilterStore, type CatalogTab } from '../../state/catalog-sidebar-filter-store'
import { CameraCatalogList } from '../camera/camera-catalog-list'
import { SensorCatalogList } from '../sensor/sensor-catalog-list'
import { FireAlarmCatalogList } from '../fire-alarm/fire-alarm-catalog-list'
import { DoriLegend } from '../camera/dori-legend'
import { SensorCoverageLegend } from '../sensor/sensor-coverage-legend'

const TABS: ReadonlyArray<{ tab: CatalogTab; label: string }> = [
  { tab: 'cameras', label: 'Cameras' },
  { tab: 'sensors', label: 'Sensors' },
  { tab: 'fire-alarm', label: 'Fire alarm' },
]

// Lookup objects (not nested ternaries) for the tab's list body and footer legend - the
// fire-alarm tab has no footer legend yet (its coverage circle has no colour-coded bands to
// key, unlike DORI/sensor kinds), so that slot is null.
const TAB_LIST: Record<CatalogTab, ComponentType<{ disabled: boolean }>> = {
  cameras: CameraCatalogList,
  sensors: SensorCatalogList,
  'fire-alarm': FireAlarmCatalogList,
}

const TAB_LEGEND: Record<CatalogTab, ComponentType | null> = {
  cameras: DoriLegend,
  sensors: SensorCoverageLegend,
  'fire-alarm': null,
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
  const scale = useProjectStore((s) => s.scale)
  const catalogTab = useCatalogSidebarFilterStore((s) => s.catalogTab)
  const setCatalogTab = useCatalogSidebarFilterStore((s) => s.setCatalogTab)

  const disabled = scale === null
  const TabList = TAB_LIST[catalogTab]
  const TabLegend = TAB_LEGEND[catalogTab]

  return (
    <aside className="flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex gap-1" role="tablist">
          {TABS.map(({ tab, label }) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={catalogTab === tab}
              data-testid={`catalog-tab-${tab}`}
              onClick={() => setCatalogTab(tab)}
              className={`flex-1 rounded px-2 py-1.5 text-sm font-semibold transition-colors ${
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
