import { useMemo } from 'react'
import { sensorModels } from '../catalog/sensor-catalog-loader'
import { SENSOR_KIND_DISPLAY_ORDER, SENSOR_KIND_LABELS } from '../domain/sensor-types'
import { useEditorUiStore } from '../state/editor-ui-store'
import { SensorCatalogModelCard } from './sensor-catalog-model-card'

interface SensorCatalogListProps {
  disabled: boolean
}

/**
 * Sensors tab body: a kind filter (All + the four kinds - one filter is
 * enough for a dozen records, no brand/price/feature filters, YAGNI) and
 * the filtered, draggable sensor cards. A kind with zero records shows a
 * dedicated message instead of the generic "no models match" text, since
 * zero is expected here (not every kind has a verified datasheet yet).
 */
export function SensorCatalogList({ disabled }: SensorCatalogListProps) {
  const kindFilter = useEditorUiStore((s) => s.sensorCatalogKindFilter)
  const setKindFilter = useEditorUiStore((s) => s.setSensorCatalogKindFilter)

  const filteredModels = useMemo(
    () => sensorModels.filter((model) => kindFilter === 'all' || model.kind === kindFilter),
    [kindFilter],
  )

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-1 text-xs">
        <button
          type="button"
          data-testid="sensor-catalog-kind-filter-all"
          onClick={() => setKindFilter('all')}
          aria-pressed={kindFilter === 'all'}
          className={`rounded px-2 py-1 ${kindFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
        >
          All
        </button>
        {SENSOR_KIND_DISPLAY_ORDER.map((kind) => (
          <button
            key={kind}
            type="button"
            data-testid={`sensor-catalog-kind-filter-${kind}`}
            onClick={() => setKindFilter(kind)}
            aria-pressed={kindFilter === kind}
            className={`rounded px-2 py-1 ${kindFilter === kind ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            {SENSOR_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {filteredModels.map((model) => (
          <SensorCatalogModelCard key={model.id} model={model} disabled={disabled} />
        ))}
        {filteredModels.length === 0 && (
          <p data-testid="sensor-catalog-empty-kind" className="text-xs text-neutral-400">
            No datasheet-verified models yet.
          </p>
        )}
      </div>
    </>
  )
}
