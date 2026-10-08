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

interface FireAlarmCatalogListProps {
  disabled: boolean
}

// Only the kinds FIRE_ALARM_KIND_CATALOG_TAB maps to 'fire-alarm' (smoke/heat/co detectors,
// call points, sounders) - the control-panel-tab kinds (including the two controller kinds)
// never appear here, so a controller is never shown nor hidden by this tab's own filters.
// Kind display order (panels and hubs first), not the data folders' alphabetical order; stable within a kind.
const TAB_MODELS = fireAlarmModels
  .filter((model) => FIRE_ALARM_KIND_CATALOG_TAB[model.kind] === 'fire-alarm')
  .sort((a, b) => FIRE_ALARM_KIND_DISPLAY_ORDER.indexOf(a.kind) - FIRE_ALARM_KIND_DISPLAY_ORDER.indexOf(b.kind))

// Computed once from the static catalog: only brands and kinds that have a record in this tab are offered.
const BRAND_OPTIONS = [...new Set(TAB_MODELS.map((model) => model.brand))]
  .sort()
  .map((brand) => ({ value: brand, label: brandDisplayLabel(brand) }))

const KIND_OPTIONS = FIRE_ALARM_KIND_DISPLAY_ORDER.filter(
  (kind) => FIRE_ALARM_KIND_CATALOG_TAB[kind] === 'fire-alarm' && TAB_MODELS.some((model) => model.kind === kind),
).map((kind) => ({ value: kind, label: FIRE_ALARM_KIND_LABELS[kind] }))

// The shared "works with" filter's options: every controller in the WHOLE catalog (control
// panels/hubs live in the Control panel tab, not this one).
const CONTROLLER_OPTIONS = fireAlarmModels
  .filter((model) => isFireAlarmControllerKind(model.kind))
  .map((model) => ({ value: model.id, label: model.model }))

/**
 * Fire-alarm tab body: brand, type and the shared "works with" (a control
 * panel / hub) drop-downs and the filtered, draggable fire-alarm cards.
 * "Works with" keeps only the devices the chosen controller's own official
 * compatibility entries list (`filterFireAlarmCatalogModels`) - the
 * controller itself never appears here (it lives in the Control panel tab).
 */
export function FireAlarmCatalogList({ disabled }: FireAlarmCatalogListProps) {
  const brandFilter = useCatalogSidebarFilterStore((s) => s.fireAlarmCatalogBrandFilter)
  const setBrandFilter = useCatalogSidebarFilterStore((s) => s.setFireAlarmCatalogBrandFilter)
  const kindFilter = useCatalogSidebarFilterStore((s) => s.fireAlarmCatalogKindFilter)
  const setKindFilter = useCatalogSidebarFilterStore((s) => s.setFireAlarmCatalogKindFilter)
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
          testId="fire-alarm-catalog-brand-filter"
          value={brandFilter}
          options={BRAND_OPTIONS}
          onChange={setBrandFilter}
        />
        <CatalogFilterSelect
          label="Type"
          testId="fire-alarm-catalog-kind-filter"
          value={kindFilter}
          options={KIND_OPTIONS}
          onChange={(value) => setKindFilter(value as FireAlarmKind | 'all')}
        />
        <CatalogFilterSelect
          label="Works with"
          testId="fire-alarm-catalog-controller-filter"
          value={controllerFilter}
          groups={[
            { label: 'Placed in this project', options: controllerGroups.placed },
            { label: 'Not placed', options: controllerGroups.notPlaced },
          ]}
          onChange={setControllerFilter}
        />
        {controllerFilter !== 'all' && (
          <p data-testid="fire-alarm-catalog-controller-filter-hint" className="text-neutral-400">
            Showing only the devices the chosen panel / hub's official list names. A hidden device is "not listed", not proven
            incompatible.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {filteredModels.map((model) => (
          <FireAlarmCatalogModelCard key={model.id} model={model} disabled={disabled} />
        ))}
        {filteredModels.length === 0 && (
          <p data-testid="fire-alarm-catalog-empty-kind" className="text-xs text-neutral-400">
            No datasheet-verified models match these filters.
          </p>
        )}
      </div>
    </>
  )
}
