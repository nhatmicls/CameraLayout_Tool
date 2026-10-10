import { buildProjectCableEndToEndLabels } from '../../domain/cable/cable-end-to-end-label'
import type { Project } from '../../domain/project-file/project-types'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'

/**
 * After the "Draw cable" tool commits a new cable ending on a shaft opening
 * (not routed beyond it yet) or on another device, names what was drawn -
 * the cable's own end-to-end label, read fresh off the just-updated project
 * (the label map's memo is keyed on `floors`, which `addCable`'s `set()`
 * always replaces with a new array, so this never reads a stale entry).
 * `null` when neither case applies - nothing to say.
 */
export function buildCableDrawnNotification(
  project: Pick<Project, 'floors' | 'shafts'>,
  floorId: string,
  cableId: string,
  endsOnShaft: boolean,
  endsOnDevice: boolean,
): string | null {
  if (!endsOnShaft && !endsOnDevice) return null
  const label = buildProjectCableEndToEndLabels(project, fireAlarmModelSpecById).get(floorId)?.get(cableId)?.label ?? '?_?'
  // A click near another device now ENDS the cable on it - name what was drawn, so a cable that
  // was only meant to pass by is noticed and undone at once.
  return endsOnDevice
    ? `${label} drawn to a device. Undo (Ctrl+Z) if the route was only meant to pass it.`
    : `${label} enters the shaft. Open the floor it leaves on, select the shaft opening and route it from there.`
}
