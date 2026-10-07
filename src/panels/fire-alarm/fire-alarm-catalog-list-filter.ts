import type { FireAlarmKind, FireAlarmModelSpec } from '../../domain/fire-alarm/fire-alarm-device-types'

export interface FireAlarmCatalogFilterCriteria {
  /** Brand id, or 'all'. */
  brand: string
  kind: FireAlarmKind | 'all'
  /** Controller model id, or 'all'. */
  compatibleWithControllerId: string
}

/**
 * Ids a chosen controller's `compatibleDevices` lists, or `null` for 'all'
 * (no filter). Pure id lookup, decoupled from `filterFireAlarmCatalogModels`
 * so the Sensors tab (which filters a merged sensor+fire-alarm item list,
 * not a `FireAlarmModelSpec[]`) can reuse it directly - an entry's
 * `modelId` may belong to this catalog OR the sensor catalog (CLAUDE.md:
 * compatibility is controller-centric and ids are disjoint across
 * catalogs), so the returned set is catalog-agnostic.
 */
export function resolveControllerListedIds<T extends FireAlarmModelSpec>(
  controllers: readonly T[],
  controllerId: string,
): ReadonlySet<string> | null {
  if (controllerId === 'all') return null
  const controller = controllers.find((model) => model.id === controllerId)
  return new Set(controller && 'compatibleDevices' in controller ? controller.compatibleDevices.map((entry) => entry.modelId) : [])
}

/**
 * Fire-alarm tab filter, AND-combined. "Compatible with controller" keeps
 * the chosen controller itself (it has to be placed too) plus every device
 * that controller's own `compatibleDevices` lists - the same official
 * entries the card and the warnings use. A device the controller does not
 * list is hidden, which means "not listed", not "proven incompatible". An
 * id that matches no controller hides everything rather than silently
 * showing all. Shared by the Fire alarm and Control panel tabs - each
 * passes its own tab's kind subset in `models` (via
 * `FIRE_ALARM_KIND_CATALOG_TAB`), so a controller never leaks into the
 * Fire alarm/Sensors tabs: it is simply not in their `models` list.
 *
 * `controllerSource` is where the chosen controller is looked up - pass the
 * FULL catalog when `models` is a tab subset that holds no controllers
 * (the Fire alarm tab), otherwise nothing would ever be listed. The chosen
 * controller itself, when it is in `models`, stays visible whatever the
 * brand / type filters say (it is the item the list is about).
 */
export function filterFireAlarmCatalogModels<T extends FireAlarmModelSpec>(
  models: readonly T[],
  criteria: FireAlarmCatalogFilterCriteria,
  controllerSource: readonly FireAlarmModelSpec[] = models,
): T[] {
  const listedIds = resolveControllerListedIds(controllerSource, criteria.compatibleWithControllerId)

  return models.filter((model) => {
    if (listedIds !== null && model.id === criteria.compatibleWithControllerId) return true
    return (
      (criteria.brand === 'all' || model.brand === criteria.brand) &&
      (criteria.kind === 'all' || model.kind === criteria.kind) &&
      (listedIds === null || listedIds.has(model.id))
    )
  })
}

export interface ControllerFilterOption {
  value: string
  label: string
}

export interface GroupedControllerFilterOptions {
  /** Controller options with >= 1 placed `PlacedFireAlarmDevice` in this project, in the given input order. */
  placed: ControllerFilterOption[]
  /** The rest, in the given input order. */
  notPlaced: ControllerFilterOption[]
}

/**
 * Splits the shared "works with" drop-down's controller options into
 * "Placed in this project" / "Not placed" `<optgroup>`s
 * (`CatalogFilterSelect`'s `groups` prop) - the Sensors, Fire alarm and
 * Control panel tabs each call this with the same full controller option
 * list and their own `useProjectStore().fireAlarmDevices`-derived id set
 * (`usePlacedFireAlarmModelIds`).
 */
export function groupControllerOptionsByPlacement(
  controllerOptions: readonly ControllerFilterOption[],
  placedModelIds: ReadonlySet<string>,
): GroupedControllerFilterOptions {
  const placed: ControllerFilterOption[] = []
  const notPlaced: ControllerFilterOption[] = []
  for (const option of controllerOptions) {
    if (placedModelIds.has(option.value)) placed.push(option)
    else notPlaced.push(option)
  }
  return { placed, notPlaced }
}
