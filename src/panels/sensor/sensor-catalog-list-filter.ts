import type { FireAlarmModel } from '../../catalog/fire-alarm/fire-alarm-catalog-loader'
import type { SensorModel } from '../../catalog/sensor/sensor-catalog-loader'

/**
 * One Sensors-tab card source: the security-sensor catalog (PIR/beam/
 * vibration/thermal) OR a fire-alarm catalog record whose kind
 * `FIRE_ALARM_KIND_CATALOG_TAB` maps to 'sensors' (magnetic-contact,
 * environment-detector - owner decision: a motion/glass-break detector
 * from the AX Hybrid PRO list goes in the SENSOR catalog instead, as a
 * `sensor` item). The tag tells `SensorCatalogList` which card component
 * and drag MIME type to use - both already exist and need no change.
 */
export type SensorTabItem = { source: 'sensor'; model: SensorModel } | { source: 'fire-alarm'; model: FireAlarmModel }

export interface SensorTabFilterCriteria {
  /** Brand id, or 'all'. */
  brand: string
  /** A `SensorKind` or sensors-tab `FireAlarmKind` value, or 'all'. */
  kind: string
  /** Ids a chosen controller's `compatibleDevices` lists (`resolveControllerListedIds` in `fire-alarm-catalog-list-filter.ts`), or null for 'all' (no filter). */
  listedIds: ReadonlySet<string> | null
}

/**
 * Sensors-tab filter: brand/kind AND-combined like every other catalog tab,
 * plus the shared "works with" controller filter. Works identically for a
 * `sensor`-sourced item (its catalog id may appear in a controller's
 * `compatibleDevices`) and a `fire-alarm`-sourced item - both model shapes
 * carry `id`/`brand`/`kind` fields.
 */
export function filterSensorTabItems(items: readonly SensorTabItem[], criteria: SensorTabFilterCriteria): SensorTabItem[] {
  return items.filter(({ model }) => {
    return (
      (criteria.brand === 'all' || model.brand === criteria.brand) &&
      (criteria.kind === 'all' || model.kind === criteria.kind) &&
      (criteria.listedIds === null || criteria.listedIds.has(model.id))
    )
  })
}
