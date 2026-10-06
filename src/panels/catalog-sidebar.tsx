import { useProjectStore } from '../state/project-store'
import { useEditorUiStore, type CatalogTab } from '../state/editor-ui-store'
import { CameraCatalogList } from './camera-catalog-list'
import { SensorCatalogList } from './sensor-catalog-list'
import { DoriLegend } from './dori-legend'
import { SensorCoverageLegend } from './sensor-coverage-legend'

const TABS: ReadonlyArray<{ tab: CatalogTab; label: string }> = [
  { tab: 'cameras', label: 'Cameras' },
  { tab: 'sensors', label: 'Sensors' },
]

/**
 * Left sidebar shell: the Cameras/Sensors tab switch, the disabled-until-
 * scale hint (shared by both tabs - neither a camera cone nor a sensor's
 * metre-based coverage means anything before the plan is calibrated), the
 * active tab's catalog list, and a footer legend that swaps with the tab
 * (phase 6). The camera tab body (`CameraCatalogList`) is the former whole
 * `CameraCatalogSidebar`, split out so this shell can also mount the sensor
 * tab without touching camera behaviour or test ids.
 */
export function CatalogSidebar() {
  const scale = useProjectStore((s) => s.scale)
  const catalogTab = useEditorUiStore((s) => s.catalogTab)
  const setCatalogTab = useEditorUiStore((s) => s.setCatalogTab)

  const disabled = scale === null

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

        {catalogTab === 'cameras' ? <CameraCatalogList disabled={disabled} /> : <SensorCatalogList disabled={disabled} />}
      </div>

      {catalogTab === 'cameras' ? <DoriLegend /> : <SensorCoverageLegend />}
    </aside>
  )
}
