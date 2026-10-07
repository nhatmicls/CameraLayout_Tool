import { useMemo } from 'react'
import { fireAlarmModels } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import { FIRE_ALARM_KIND_DISPLAY_ORDER, FIRE_ALARM_KIND_LABELS } from '../../domain/fire-alarm/fire-alarm-device-types'
import { useCatalogSidebarFilterStore } from '../../state/catalog-sidebar-filter-store'
import { FireAlarmCatalogModelCard } from './fire-alarm-catalog-model-card'

interface FireAlarmCatalogListProps {
  disabled: boolean
}

// Computed once from the static catalog: only kinds with >= 1 shipped record get a filter
// button (success criterion - unlike the sensor tab, which always shows all four kind
// buttons even at zero records).
const PRESENT_KINDS = FIRE_ALARM_KIND_DISPLAY_ORDER.filter((kind) => fireAlarmModels.some((model) => model.kind === kind))

/**
 * Fire-alarm tab body: a kind filter (All + only the kinds with >= 1 record)
 * and the filtered, draggable fire-alarm cards - the fire-alarm twin of
 * `sensor-catalog-list.tsx`.
 */
export function FireAlarmCatalogList({ disabled }: FireAlarmCatalogListProps) {
  const kindFilter = useCatalogSidebarFilterStore((s) => s.fireAlarmCatalogKindFilter)
  const setKindFilter = useCatalogSidebarFilterStore((s) => s.setFireAlarmCatalogKindFilter)

  const filteredModels = useMemo(
    () => fireAlarmModels.filter((model) => kindFilter === 'all' || model.kind === kindFilter),
    [kindFilter],
  )

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-1 text-xs">
        <button
          type="button"
          data-testid="fire-alarm-catalog-kind-filter-all"
          onClick={() => setKindFilter('all')}
          aria-pressed={kindFilter === 'all'}
          className={`rounded px-2 py-1 ${kindFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
        >
          All
        </button>
        {PRESENT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            data-testid={`fire-alarm-catalog-kind-filter-${kind}`}
            onClick={() => setKindFilter(kind)}
            aria-pressed={kindFilter === kind}
            className={`rounded px-2 py-1 ${kindFilter === kind ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            {FIRE_ALARM_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {filteredModels.map((model) => (
          <FireAlarmCatalogModelCard key={model.id} model={model} disabled={disabled} />
        ))}
        {filteredModels.length === 0 && (
          <p data-testid="fire-alarm-catalog-empty-kind" className="text-xs text-neutral-400">
            No datasheet-verified models in this kind.
          </p>
        )}
      </div>
    </>
  )
}
