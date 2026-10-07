import { DEFAULT_CABLE_SETTINGS } from '../../domain/cable/cable-layout-types'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { selectCables, selectHubs } from '../../state/project-store-floor-selectors'
import { useCableLayoutEstimate } from '../../state/use-cable-layout-estimate'
import { CableEstimateTotalsTable } from './cable-estimate-totals-table'
import { CableSettingsInputs } from './cable-settings-inputs'
import { CableTypesEditorTable } from './cable-types-editor-table'

const summaryClass = 'cursor-pointer select-none text-xs font-semibold text-neutral-600'

/**
 * Right-aside cable panel, between the properties panel and the BOM: totals
 * per cable type, the editable cable types and the estimate allowances.
 * Native `<details>` sections - the aside is 320 px wide and already long,
 * and they need no state of their own.
 */
export function CableEstimatePanel() {
  const hubs = useProjectStore(selectHubs)
  const cables = useProjectStore(selectCables)
  const cableTypes = useProjectStore((s) => s.cableTypes)
  const cableSettings = useProjectStore((s) => s.cableSettings)
  const addCableType = useProjectStore((s) => s.addCableType)
  const updateCableType = useProjectStore((s) => s.updateCableType)
  const deleteCableType = useProjectStore((s) => s.deleteCableType)
  const updateCableSettings = useProjectStore((s) => s.updateCableSettings)
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const estimate = useCableLayoutEstimate()

  const handleAddType = () =>
    addCableType({ id: crypto.randomUUID(), name: 'New cable type', lengthLimitM: null, pricePerMeterVnd: null })

  const handleDeleteType = (id: string) => {
    if (!deleteCableType(id)) pushNotification('error', 'This cable type is in use by a cable (or is the last one) and cannot be deleted.')
  }

  return (
    <div data-testid="cable-estimate-panel" className="mt-4 border-t border-neutral-200 pt-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Cables</h2>
        <span data-testid="cable-estimate-count" className="text-xs text-neutral-500">
          {hubs.length} hub{hubs.length === 1 ? '' : 's'}, {cables.length} cable{cables.length === 1 ? '' : 's'}
        </span>
      </div>

      <details open className="mt-2">
        <summary className={summaryClass}>Totals</summary>
        <CableEstimateTotalsTable estimate={estimate} cableTypes={cableTypes} cableCount={cables.length} />
      </details>

      {/* Keyed on "has anything": the section opens by itself with the first hub or cable, and stays under the user's control after that. */}
      <details key={hubs.length + cables.length > 0 ? 'in-use' : 'unused'} open={hubs.length + cables.length > 0} className="mt-3">
        <summary className={summaryClass}>Cable types</summary>
        <CableTypesEditorTable
          cableTypes={cableTypes}
          cables={cables}
          onUpdate={updateCableType}
          onAdd={handleAddType}
          onDelete={handleDeleteType}
        />
      </details>

      <details className="mt-3">
        <summary className={summaryClass}>Allowances</summary>
        <CableSettingsInputs
          settings={cableSettings}
          onChange={updateCableSettings}
          onReset={() => updateCableSettings(DEFAULT_CABLE_SETTINGS)}
        />
      </details>
    </div>
  )
}
