import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import { DEFAULT_FIRE_ALARM_SETTINGS } from '../fire-alarm/fire-alarm-device-types'
import type { Project } from '../project-file/project-types'
import { buildProjectCableEndToEndLabels } from './cable-end-to-end-label'
import type { MetersInterval } from './cable-length-estimate-calculator'
import { computeProjectCableEstimate } from './project-cable-layout-estimate'
import { describeUnestimatedReason } from './unestimated-cables-summary'

/**
 * Every cable as one row: its own end-to-end label, type, length including
 * the current spare allowance (or a reason it has none) - the panel's
 * per-cable list and the cable length estimate CSV both read this, so they
 * can never drift from each other or from the project cable estimate.
 */

/** `fireAlarmSettings` is not part of this: `computeProjectCableEstimate` never reads it (confirmed by its own cache key, which omits it). */
export type CableListProject = Pick<Project, 'floors' | 'shafts' | 'cableTypes' | 'cableSettings'>

export interface CableListRow {
  cableId: string
  floorId: string
  /** The end-to-end label as-is ("F1_C3_F2_H1") - never prefixed, not unique. */
  label: string
  typeId: string
  typeName: string
  /** Run + spare allowance (`CableLengthEstimate.purchase`); `null` = not estimated. */
  lengthWithSpare: MetersInterval | null
  /** `null` = estimated (or not applicable). Never a guessed number. */
  unestimatedReason: string | null
  /** Set only for an ESTIMATED cable that still needs attention (today: routed up to a shaft only). Kept apart from `unestimatedReason` - the two are never both set. */
  note: string | null
}

export interface BuildProjectCableListRowsOptions {
  /** One floor's cables only; omitted = every floor, in floor order. */
  floorId?: string
  fireAlarmModelById?: FireAlarmKindByModelId
}

const SCALE_NOT_SET_REASON = 'floor has no scale set'
const DANGLING_REASON = 'lost its start or end'
const UNKNOWN_TYPE_REASON = 'unknown cable type'
const SHAFT_NOT_ROUTED_NOTE = 'not routed beyond its shaft - counted up to the shaft only'

/**
 * One row per cable of the floor(s) in view, in floor-then-cable order.
 * Lengths come ONLY from `computeProjectCableEstimate` (`purchase`, which
 * already includes the live spare allowance) - never a literal percent
 * computed here. A cable missing from the estimate is named by the first
 * reason that applies (never two at once): this floor has no scale; an
 * unavailable-coded warning naming THIS cable (a linked floor's scale, or a
 * cross-floor cycle); its type no longer exists; or, last, it lost its
 * start or end device/hub.
 */
export function buildProjectCableListRows(project: CableListProject, options: BuildProjectCableListRowsOptions = {}): CableListRow[] {
  // `fireAlarmSettings` is synthesised (never read by the estimate - see `CableListProject`'s own
  // doc comment) rather than widening this function's own input type to carry it.
  const fullProject: Project = { ...project, fireAlarmSettings: DEFAULT_FIRE_ALARM_SETTINGS }
  const estimate = computeProjectCableEstimate(fullProject, options.fireAlarmModelById)
  const labelsByFloorId = buildProjectCableEndToEndLabels(project, options.fireAlarmModelById)
  const typeNameById = new Map(project.cableTypes.map((type): [string, string] => [type.id, type.name]))

  const floorsInView = options.floorId ? project.floors.filter((floor) => floor.id === options.floorId) : project.floors
  const rows: CableListRow[] = []

  for (const floor of floorsInView) {
    const floorEstimate = estimate.byFloorId.get(floor.id)
    const floorLabels = labelsByFloorId.get(floor.id)

    for (const cable of floor.cables) {
      const label = floorLabels?.get(cable.id)?.label ?? '?_?'
      const typeName = typeNameById.get(cable.typeId)
      const base = { cableId: cable.id, floorId: floor.id, label, typeId: cable.typeId, typeName: typeName ?? '' }

      if (floor.scale === null) {
        rows.push({ ...base, lengthWithSpare: null, unestimatedReason: SCALE_NOT_SET_REASON, note: null })
        continue
      }

      const cableEstimate = floorEstimate?.byCableId.get(cable.id)
      if (cableEstimate) {
        const notRouted = floorEstimate?.warnings.some((warning) => warning.code === 'shaft-cable-not-routed' && warning.cableId === cable.id)
        rows.push({ ...base, lengthWithSpare: cableEstimate.purchase, unestimatedReason: null, note: notRouted ? SHAFT_NOT_ROUTED_NOTE : null })
        continue
      }

      const unavailableReason = floorEstimate?.warnings
        .filter((warning) => warning.cableId === cable.id)
        .map((warning) => describeUnestimatedReason(warning.code))
        .find((reason): reason is string => reason !== null)
      if (unavailableReason) {
        rows.push({ ...base, lengthWithSpare: null, unestimatedReason: unavailableReason, note: null })
        continue
      }

      rows.push({ ...base, lengthWithSpare: null, unestimatedReason: typeName ? DANGLING_REASON : UNKNOWN_TYPE_REASON, note: null })
    }
  }

  return rows
}

/** `Cable, Type, Length (+N% spare) (m), Notes` - length is the nominal purchase metres, 1 decimal, plain number; empty when unestimated. */
export function cableListToCsvTable(rows: readonly CableListRow[], sparePercent: number): string[][] {
  const header = ['Cable', 'Type', `Length (+${sparePercent}% spare) (m)`, 'Notes']
  const body = rows.map((row) => [
    row.label,
    row.typeName,
    row.lengthWithSpare === null ? '' : row.lengthWithSpare.nominal.toFixed(1),
    row.unestimatedReason ? `not estimated: ${row.unestimatedReason}` : row.note ?? '',
  ])
  return [header, ...body]
}
