import { useMemo } from 'react'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import {
  FIRE_ALARM_KIND_CATALOG_TAB,
  FIRE_ALARM_KIND_DISPLAY_ORDER,
  FIRE_ALARM_KIND_LABELS,
  isFireAlarmControllerKind,
  type FireAlarmKind,
} from '../../domain/fire-alarm/fire-alarm-device-types'
import { useCatalogSidebarFilterStore } from '../../state/catalog-sidebar-filter-store'
import { brandDisplayLabel } from '../shared/brand-display-label'
import { CatalogFilterSelect } from '../shared/catalog-filter-select'
import { filterFireAlarmCatalogModels, groupControllerOptionsByPlacement } from './fire-alarm-catalog-list-filter'
import { usePlacedFireAlarmModelIds } from './use-placed-fire-alarm-model-ids'
import { FireAlarmCatalogModelCard } from './fire-alarm-catalog-model-card'

interface ControlPanelCatalogListProps {
  disabled: boolean
}

// Control panels/hubs plus their own modules and accessories (expander module, keypad,
// keyfob, tag reader, relay module, repeater, communicator, power supply, accessory) -
// every kind FIRE_ALARM_KIND_CATALOG_TAB maps to 'control-panel'.
// Kind display order (panels and hubs first), not the data folders' alphabetical order; stable within a kind.
const TAB_MODELS = fireAlarmModels
  .filter((model) => FIRE_ALARM_KIND_CATALOG_TAB[model.kind] === 'control-panel')
  .sort((a, b) => FIRE_ALARM_KIND_DISPLAY_ORDER.indexOf(a.kind) - FIRE_ALARM_KIND_DISPLAY_ORDER.indexOf(b.kind))

const BRAND_OPTIONS = [...new Set(TAB_MODELS.map((model) => model.brand))]
  .sort()
  .map((brand) => ({ value: brand, label: brandDisplayLabel(brand) }))

const KIND_OPTIONS = FIRE_ALARM_KIND_DISPLAY_ORDER.filter(
  (kind) => FIRE_ALARM_KIND_CATALOG_TAB[kind] === 'control-panel' && TAB_MODELS.some((model) => model.kind === kind),
).map((kind) => ({ value: kind, label: FIRE_ALARM_KIND_LABELS[kind] }))

const CONTROLLER_OPTIONS = fireAlarmModels
  .filter((model) => isFireAlarmControllerKind(model.kind))
  .map((model) => ({ value: model.id, label: model.model }))

/**
 * Control panel tab body: control panels/hubs and their own modules /
 * accessories, brand + type drop-downs scoped to this tab
 * (`FIRE_ALARM_KIND_CATALOG_TAB`), and the shared "works with" filter -
 * here it filters the chosen panel/hub's own modules/accessories while
 * ALWAYS keeping the panel/hub itself visible (`filterFireAlarmCatalogModels`'s
 * "keep `model.id === controllerId`" rule), unlike the Sensors and Fire
 * alarm tabs where the controller is never a member of `TAB_MODELS` at all.
 */
export function ControlPanelCatalogList({ disabled }: ControlPanelCatalogListProps) {
  const brandFilter = useCatalogSidebarFilterStore((s) => s.controlPanelCatalogBrandFilter)
  const setBrandFilter = useCatalogSidebarFilterStore((s) => s.setControlPanelCatalogBrandFilter)
  const kindFilter = useCatalogSidebarFilterStore((s) => s.controlPanelCatalogKindFilter)
  const setKindFilter = useCatalogSidebarFilterStore((s) => s.setControlPanelCatalogKindFilter)
  const controllerFilter = useCatalogSidebarFilterStore((s) => s.catalogControllerFilter)
  const setControllerFilter = useCatalogSidebarFilterStore((s) => s.setCatalogControllerFilter)
  const placedModelIds = usePlacedFireAlarmModelIds()

  const controllerGroups = useMemo(
    () => groupControllerOptionsByPlacement(CONTROLLER_OPTIONS, placedModelIds),
    [placedModelIds],
  )

  const filteredModels = useMemo(
    () =>
      filterFireAlarmCatalogModels(
        TAB_MODELS,
        { brand: brandFilter, kind: kindFilter, compatibleWithControllerId: controllerFilter },
        fireAlarmModels,
      ),
    [brandFilter, kindFilter, controllerFilter],
  )

  return (
    <>
      <div className="mt-3 flex flex-col gap-2 text-xs">
        <CatalogFilterSelect
          label="Brand"
          testId="control-panel-catalog-brand-filter"
          value={brandFilter}
          options={BRAND_OPTIONS}
          onChange={setBrandFilter}
        />
        <CatalogFilterSelect
          label="Type"
          testId="control-panel-catalog-kind-filter"
          value={kindFilter}
          options={KIND_OPTIONS}
          onChange={(value) => setKindFilter(value as FireAlarmKind | 'all')}
        />
        <CatalogFilterSelect
          label="Works with"
          testId="control-panel-catalog-controller-filter"
          value={controllerFilter}
          groups={[
            { label: 'Placed in this project', options: controllerGroups.placed },
            { label: 'Not placed', options: controllerGroups.notPlaced },
          ]}
          onChange={setControllerFilter}
        />
        {controllerFilter !== 'all' && (
          <p data-testid="control-panel-catalog-controller-filter-hint" className="text-neutral-400">
            Showing the chosen panel / hub and the modules / accessories its official list names. A hidden device is "not
            listed", not proven incompatible.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {filteredModels.map((model) => (
          <FireAlarmCatalogModelCard key={model.id} model={model} disabled={disabled} />
        ))}
        {filteredModels.length === 0 && (
          <p data-testid="control-panel-catalog-empty-kind" className="text-xs text-neutral-400">
            No datasheet-verified models match these filters.
          </p>
        )}
      </div>
    </>
  )
}
