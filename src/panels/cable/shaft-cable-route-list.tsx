import { useMemo } from 'react'
import { polylineLengthPx } from '../../domain/cable/cable-length-estimate-calculator'
import { formatMeters } from '../../domain/cable/cable-length-format'
import { listShaftCables, type ShaftCableEntry } from '../../domain/cable/shaft-cable-leg'
import type { Floor } from '../../domain/floor/floor-types'
import { planPxToMeters } from '../../domain/shared/scale-calibration-calculator'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { useEditorUiStore } from '../../state/editor-ui-store'
import { useProjectStore } from '../../state/project-store'
import { secondaryButtonClass } from '../camera/camera-properties-form-helpers'

const DRAW_LEG_HINT = 'Click to add route points, then click a hub or a device to finish. Backspace undoes a point, Esc cancels.'

interface ShaftCableRouteListProps {
  floors: Floor[]
  shaftIds: string[]
  shaftId: string
  /** Index of the floor being viewed - a route is always drawn on THIS floor, from its own opening. */
  floorIndex: number
}

/** "-> Floor 1 H2, route 6.0 m" for a routed cable; the route is measured on the exit floor's own scale. */
function describeLeg(floors: readonly Floor[], entry: ShaftCableEntry): string {
  const { leg } = entry
  if (!leg) return 'not routed'
  const exitFloor = floors[leg.exitFloorIndex]
  const routeM = exitFloor.scale ? formatMeters(planPxToMeters(polylineLengthPx(leg.pathPx), exitFloor.scale.planPxPerMeter)) : 'no scale'
  return `-> ${exitFloor.name} ${leg.end.label}, route ${routeM}`
}

/**
 * The shaft panel's cable list: every cable that enters this shaft on any
 * floor, named by the device it comes from ("Floor 2 C1"), with where it
 * goes beyond the shaft. "Route from here" draws that cable's own route on
 * the floor being viewed - from this floor's opening to a hub or a device -
 * replacing any route it already had; "Remove route" puts it back to "not
 * routed" (counted up to the shaft only).
 */
export function ShaftCableRouteList({ floors, shaftIds, shaftId, floorIndex }: ShaftCableRouteListProps) {
  const setCableShaftLeg = useProjectStore((s) => s.setCableShaftLeg)
  const setShaftLegDrawCable = useEditorUiStore((s) => s.setShaftLegDrawCable)
  const setToolMode = useEditorUiStore((s) => s.setToolMode)
  // The trunk tool reads which cable it draws for ONCE, on entry: while it is open, starting
  // another cable's route would still write to the first cable - so the buttons wait.
  const drawing = useEditorUiStore((s) => s.toolMode === 'trunk')
  const pushNotification = useEditorUiStore((s) => s.pushNotification)
  const entries = useMemo(
    () => listShaftCables(floors, shaftId, { shaftIds, fireAlarmModelById: fireAlarmModelSpecById, indexCache: new Map() }),
    [floors, shaftId, shaftIds],
  )
  const notRouted = entries.filter((entry) => !entry.leg).length
  const floor = floors[floorIndex]

  const handleRoute = (entry: ShaftCableEntry) => {
    // The trunk tool draws it: start = the selected opening (this panel's own hub).
    setShaftLegDrawCable({ floorId: floors[entry.floorIndex].id, cableId: entry.cable.id })
    setToolMode('trunk')
    pushNotification('info', DRAW_LEG_HINT)
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <p className="text-xs font-medium text-neutral-700">Cables through this shaft</p>
      <p data-testid="shaft-cables-in" className="mt-1 text-xs text-neutral-600">
        Cables in: {entries.length}
      </p>
      <p data-testid="shaft-not-routed-count" className={`mt-1 text-xs font-medium ${notRouted > 0 ? 'text-amber-700' : 'text-green-700'}`}>
        Not routed: {notRouted}
      </p>
      <ul className="mt-2 space-y-2">
        {entries.map((entry) => {
          const routedHere = entry.leg?.exitFloorIndex === floorIndex
          return (
            <li key={`${entry.floorIndex}:${entry.cable.id}`} data-testid={`shaft-cable-${entry.cable.id}`} className="text-xs text-neutral-600">
              <span className="font-medium text-neutral-800">{`From ${floors[entry.floorIndex].name} ${entry.deviceLabel}`}</span>
              <span data-testid={`shaft-cable-route-text-${entry.cable.id}`}>{` ${describeLeg(floors, entry)}`}</span>
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  data-testid={`shaft-cable-route-button-${entry.cable.id}`}
                  onClick={() => handleRoute(entry)}
                  disabled={drawing}
                  className={`flex-1 ${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {routedHere ? 'Redraw route' : `Route on ${floor.name}`}
                </button>
                {entry.leg && (
                  <button
                    type="button"
                    data-testid={`shaft-cable-remove-route-button-${entry.cable.id}`}
                    onClick={() => setCableShaftLeg(floors[entry.floorIndex].id, entry.cable.id, null)}
                    disabled={drawing}
                    className={`flex-1 ${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Remove route
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
