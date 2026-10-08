import { useMemo } from 'react'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { sensorModels } from '../../catalog/sensor/sensor-catalog-loader'
import {
  FIRE_ALARM_KIND_CATALOG_TAB,
  FIRE_ALARM_KIND_DISPLAY_ORDER,
  FIRE_ALARM_KIND_LABELS,
  isFireAlarmControllerKind,
  type FireAlarmKind,
} from '../../domain/fire-alarm/fire-alarm-device-types'
import { SENSOR_KIND_DISPLAY_ORDER, SENSOR_KIND_LABELS, type SensorKind } from '../../domain/sensor/sensor-types'
import { useCatalogSidebarFilterStore } from '../../state/catalog-sidebar-filter-store'
import { brandDisplayLabel } from '../shared/brand-display-label'
import { CatalogFilterSelect } from '../shared/catalog-filter-select'
import { FireAlarmCatalogModelCard } from '../fire-alarm/fire-alarm-catalog-model-card'
import { groupControllerOptionsByPlacement, resolveControllerListedIds } from '../fire-alarm/fire-alarm-catalog-list-filter'
import { usePlacedFireAlarmModelIds } from '../fire-alarm/use-placed-fire-alarm-model-ids'
import { filterSensorTabItems, type SensorTabItem } from './sensor-catalog-list-filter'
import { SensorCatalogModelCard } from './sensor-catalog-model-card'

interface SensorCatalogListProps {
  disabled: boolean
}

// Fire-alarm catalog records mapped to this tab (CLAUDE.md FIRE_ALARM_KIND_CATALOG_TAB:
// magnetic-contact, environment-detector and the datasheet-less intrusion-detector today -
// motion/glass-break detectors WITH a datasheet go in the SENSOR catalog instead, as a plain
// `sensor` item below).
const SENSOR_TAB_FIRE_ALARM_MODELS = fireAlarmModels.filter((model) => FIRE_ALARM_KIND_CATALOG_TAB[model.kind] === 'sensors')

const ALL_ITEMS: SensorTabItem[] = [
  ...sensorModels.map((model) => ({ source: 'sensor' as const, model })),
  ...SENSOR_TAB_FIRE_ALARM_MODELS.map((model) => ({ source: 'fire-alarm' as const, model })),
]

// Computed once from the two static catalogs: only brands and kinds that have a record in this tab are offered.
const BRAND_OPTIONS = [...new Set(ALL_ITEMS.map((item) => item.model.brand))]
  .sort()
  .map((brand) => ({ value: brand, label: brandDisplayLabel(brand) }))

const SENSOR_KIND_OPTIONS = SENSOR_KIND_DISPLAY_ORDER.filter((kind) => sensorModels.some((model) => model.kind === kind)).map(
  (kind) => ({ value: kind, label: SENSOR_KIND_LABELS[kind] }),
)

const FIRE_ALARM_KIND_OPTIONS = FIRE_ALARM_KIND_DISPLAY_ORDER.filter(
  (kind) => FIRE_ALARM_KIND_CATALOG_TAB[kind] === 'sensors' && SENSOR_TAB_FIRE_ALARM_MODELS.some((model) => model.kind === kind),
).map((kind) => ({ value: kind, label: FIRE_ALARM_KIND_LABELS[kind] }))

// Merged Type drop-down: sensor kinds first, then the sensors-tab fire-alarm kinds.
const KIND_OPTIONS = [...SENSOR_KIND_OPTIONS, ...FIRE_ALARM_KIND_OPTIONS]

// The shared "works with" filter's options: every controller in the fire-alarm catalog.
const CONTROLLER_OPTIONS = fireAlarmModels
  .filter((model) => isFireAlarmControllerKind(model.kind))
  .map((model) => ({ value: model.id, label: model.model }))

/**
 * Sensors tab body: the security-sensor catalog (PIR/beam/vibration/
 * thermal) AND the fire-alarm catalog's sensors-tab kinds, merged into one
 * brand/type-filtered, draggable list - each item keeps its own card
 * component and drag MIME type (`SensorCatalogModelCard`/
 * `FireAlarmCatalogModelCard`, both already wired to their own drop
 * targets). The shared "works with" controller filter hides a device not
 * in the chosen panel/hub's `compatibleDevices` - sensor-catalog ids
 * included (CLAUDE.md: compatibility is controller-centric and may now
 * point at a sensor record).
 */
export function SensorCatalogList({ disabled }: SensorCatalogListProps) {
  const brandFilter = useCatalogSidebarFilterStore((s) => s.sensorCatalogBrandFilter)
  const setBrandFilter = useCatalogSidebarFilterStore((s) => s.setSensorCatalogBrandFilter)
  const kindFilter = useCatalogSidebarFilterStore((s) => s.sensorCatalogKindFilter)
  const setKindFilter = useCatalogSidebarFilterStore((s) => s.setSensorCatalogKindFilter)
  const controllerFilter = useCatalogSidebarFilterStore((s) => s.catalogControllerFilter)
  const setControllerFilter = useCatalogSidebarFilterStore((s) => s.setCatalogControllerFilter)
  const placedModelIds = usePlacedFireAlarmModelIds()

  const controllerGroups = useMemo(
    () => groupControllerOptionsByPlacement(CONTROLLER_OPTIONS, placedModelIds),
    [placedModelIds],
  )

  const filteredItems = useMemo(() => {
    const listedIds = resolveControllerListedIds(fireAlarmModels, controllerFilter)
    return filterSensorTabItems(ALL_ITEMS, { brand: brandFilter, kind: kindFilter, listedIds })
  }, [brandFilter, kindFilter, controllerFilter])

  return (
    <>
      <div className="mt-3 flex flex-col gap-2 text-xs">
        <CatalogFilterSelect
          label="Brand"
          testId="sensor-catalog-brand-filter"
          value={brandFilter}
          options={BRAND_OPTIONS}
          onChange={setBrandFilter}
        />
        <CatalogFilterSelect
          label="Type"
          testId="sensor-catalog-kind-filter"
          value={kindFilter}
          options={KIND_OPTIONS}
          onChange={(value) => setKindFilter(value as SensorKind | FireAlarmKind | 'all')}
        />
        <CatalogFilterSelect
          label="Works with"
          testId="sensor-catalog-controller-filter"
          value={controllerFilter}
          groups={[
            { label: 'Placed in this project', options: controllerGroups.placed },
            { label: 'Not placed', options: controllerGroups.notPlaced },
          ]}
          onChange={setControllerFilter}
        />
        {controllerFilter !== 'all' && (
          <p data-testid="sensor-catalog-controller-filter-hint" className="text-neutral-400">
            Showing only the devices the chosen panel / hub's official list names. A hidden device is "not listed", not proven
            incompatible.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {filteredItems.map((item) =>
          item.source === 'sensor' ? (
            <SensorCatalogModelCard key={item.model.id} model={item.model} disabled={disabled} />
          ) : (
            <FireAlarmCatalogModelCard key={item.model.id} model={item.model} disabled={disabled} />
          ),
        )}
        {filteredItems.length === 0 && (
          <p data-testid="sensor-catalog-empty-kind" className="text-xs text-neutral-400">
            No datasheet-verified models match these filters.
          </p>
        )}
      </div>
    </>
  )
}
