import type { FireAlarmKindByModelId } from '../fire-alarm/fire-alarm-device-designator'
import type { Floor } from '../floor/floor-types'
import { floorPositionPrefix } from '../floor/floor-label-prefix'
import type { Project } from '../project-file/project-types'
import { cableEndRefKey } from './cable-endpoint-index'
import { walkCrossFloorRoute, type CrossFloorRouteEnd } from './cross-floor-route-walker'
import { buildFloorCableEndpointIndex, type ResolvedShaftLeg, type ShaftLegLookups } from './shaft-cable-leg'

/**
 * The ONE place a cable's end-to-end label is built: `<F{n}_start>_<F{m}_finalEnd>`,
 * e.g. `F1_C3_F2_H1`, `F1_C1_F2_P1`, `F1_C1_F1_C2`. Both ends always carry
 * their floor, one-floor project too; an unresolved end is a bare `?`
 * (`F1_C3_?`, `?_F2_H1`). Every surface (estimates, warnings, BOM rows, the
 * cable panel, the draw-tool notification) reads this map - there is no
 * other label producer.
 */

export const CABLE_LABEL_SEPARATOR = '_'
export const CABLE_LABEL_UNKNOWN_END = '?'

type LabelEnd = { floorIndex: number; label: string } | null | undefined

export interface CableEndToEndLabel {
  cableId: string
  /** "F1_C3_F2_H1", "F1_C1_F2_P1", "F1_C1_F1_C2", "F1_C3_?", "?_F2_H1" - the ONE string for every surface; never prefixed again. */
  label: string
  start: { floorIndex: number; label: string } | null
  /** The final plain hub or device reached; null = open route (riser / drop / shaft not routed, cycle, broken or missing). */
  finalEnd: { kind: 'hub' | 'device'; floorIndex: number; label: string } | null
}

/** Resolved end = `F{n}_<label>`; unresolved (null/undefined) end = bare `?`. */
export function formatCableEndToEndLabel(start: LabelEnd, finalEnd: LabelEnd): string {
  const startPart = start ? `${floorPositionPrefix(start.floorIndex)}${start.label}` : CABLE_LABEL_UNKNOWN_END
  const endPart = finalEnd ? `${floorPositionPrefix(finalEnd.floorIndex)}${finalEnd.label}` : CABLE_LABEL_UNKNOWN_END
  return `${startPart}${CABLE_LABEL_SEPARATOR}${endPart}`
}

/**
 * A walked route's end, as the label builder sees it: only a DEVICE, or a
 * HUB whose own `kind` is a plain hub (`kind` omitted), counts as "finally
 * reached" - a terminal riser / drop / shaft opening (not routed further)
 * is an open end, same as a cycle, a broken chain or a missing end.
 */
function resolveFinalEnd(project: Pick<Project, 'floors'>, end: CrossFloorRouteEnd, lookups: ShaftLegLookups): CableEndToEndLabel['finalEnd'] {
  if (end.kind === 'device') return { kind: 'device', floorIndex: end.floorIndex, label: end.device.label }
  if (end.kind !== 'hub' || (end.hub.kind ?? 'hub') !== 'hub') return null
  const floor = project.floors[end.floorIndex]
  const label = buildFloorCableEndpointIndex(floor, lookups).hubById.get(end.hub.id)?.label
  return label ? { kind: 'hub', floorIndex: end.floorIndex, label } : null
}

/** Single-slot, reference-equality memo - mirrors `computeProjectCableEstimate`'s own cache (the app has exactly one live project). */
let memoKey: { floors: Project['floors']; shafts: Project['shafts']; fireAlarmModelById: FireAlarmKindByModelId | undefined } | null = null
let memoResult: ReadonlyMap<string, ReadonlyMap<string, CableEndToEndLabel>> | null = null

/** floorId -> cableId -> its end-to-end label, for every cable of every floor. `fireAlarmModelById` omitted = a fire-alarm end reads "?{n}" (unknown model). */
export function buildProjectCableEndToEndLabels(
  project: Pick<Project, 'floors' | 'shafts'>,
  fireAlarmModelById?: FireAlarmKindByModelId,
): ReadonlyMap<string, ReadonlyMap<string, CableEndToEndLabel>> {
  if (memoKey && memoKey.floors === project.floors && memoKey.shafts === project.shafts && memoKey.fireAlarmModelById === fireAlarmModelById) {
    return memoResult!
  }

  const lookups: ShaftLegLookups = { shaftIds: project.shafts.map((shaft) => shaft.id), fireAlarmModelById, indexCache: new Map() }
  const result = new Map<string, Map<string, CableEndToEndLabel>>()
  project.floors.forEach((floor, floorIndex) => {
    const index = buildFloorCableEndpointIndex(floor, lookups)
    const cableMap = new Map<string, CableEndToEndLabel>()
    for (const cable of floor.cables) {
      const startDevice = index.deviceByKey.get(cableEndRefKey(cable.device))
      const start = startDevice ? { floorIndex, label: startDevice.label } : null
      const route = walkCrossFloorRoute(project.floors, floorIndex, cable, lookups)
      const finalEnd = resolveFinalEnd(project, route.end, lookups)
      cableMap.set(cable.id, { cableId: cable.id, label: formatCableEndToEndLabel(start, finalEnd), start, finalEnd })
    }
    result.set(floor.id, cableMap)
  })

  memoKey = { floors: project.floors, shafts: project.shafts, fireAlarmModelById }
  memoResult = result
  return result
}

/** Per-input-map cache: the same floor's label map (identity-stable while `buildProjectCableEndToEndLabels`'s own memo hits) always returns the SAME string map back, so a canvas memo keyed on it is never defeated. */
const labelStringsCache = new WeakMap<ReadonlyMap<string, CableEndToEndLabel>, ReadonlyMap<string, string>>()

/** A floor's own label map, reduced to `cableId -> label` (the canvas/PNG draw text, nothing else). */
export function selectCableLabelStrings(labels: ReadonlyMap<string, CableEndToEndLabel>): ReadonlyMap<string, string> {
  const cached = labelStringsCache.get(labels)
  if (cached) return cached
  const strings = new Map<string, string>()
  for (const [cableId, entry] of labels) strings.set(cableId, entry.label)
  labelStringsCache.set(labels, strings)
  return strings
}

/**
 * The SAME label string as each leg's own cable (a leg is drawn on its EXIT
 * floor, but its cable - and so its label - belongs to the floor it starts
 * on, `leg.sourceFloorIndex`). Index-aligned with `legs`; `''` for a leg
 * whose source floor or cable is somehow missing from `allLabels`
 * (defensive only - every leg here comes from a live cable on a live floor).
 */
export function resolveShaftLegLabels(
  legs: readonly ResolvedShaftLeg[],
  floors: readonly Floor[],
  allLabels: ReadonlyMap<string, ReadonlyMap<string, CableEndToEndLabel>>,
): string[] {
  return legs.map((leg) => {
    const floorId = floors[leg.sourceFloorIndex]?.id
    return floorId === undefined ? '' : allLabels.get(floorId)?.get(leg.cable.id)?.label ?? ''
  })
}
