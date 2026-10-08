import { hubLabels } from '../../domain/cable/cable-endpoint-index'
import { findShaftExits } from '../../domain/cable/shaft-integrity'
import type { Cable, Hub } from '../../domain/cable/cable-layout-types'
import type { Floor } from '../../domain/floor/floor-types'
import { useProjectStore } from '../../state/project-store'
import { fieldLabelClass, inputClass } from '../camera/camera-properties-form-helpers'

interface CableShaftExitSelectProps {
  floors: Floor[]
  shaftIds: string[]
  cable: Cable
  /** The shaft marker the cable ends on. */
  hub: Hub
}

/**
 * Cable panel's "Exit" select: shown only when the cable ends on a shaft
 * with SEVERAL exits (0 or 1, there is nothing to choose - the resolver
 * handles both without this). Clearing the choice (blank option) leaves the
 * cable unestimated again until a real exit is picked - never a guess.
 */
export function CableShaftExitSelect({ floors, shaftIds, cable, hub }: CableShaftExitSelectProps) {
  const setCableExitFloorId = useProjectStore((s) => s.setCableExitFloorId)
  if (!hub.shaftId) return null
  const exits = findShaftExits(floors, hub.shaftId)
  if (exits.length < 2) return null

  return (
    <>
      <label className={fieldLabelClass} htmlFor="cable-exit-select">
        Exit
      </label>
      <select
        id="cable-exit-select"
        data-testid="cable-exit-select"
        value={cable.exitFloorId ?? ''}
        onChange={(e) => setCableExitFloorId(cable.id, e.target.value === '' ? null : e.target.value)}
        className={inputClass}
      >
        <option value="">Choose an exit...</option>
        {exits.map((exit) => {
          const exitFloor = floors[exit.floorIndex]
          const labels = hubLabels(exitFloor.hubs, shaftIds)
          const targetIndex = exitFloor.hubs.findIndex((candidate) => candidate.id === exit.hub.trunk!.hubId)
          return (
            <option key={exit.floorId} value={exit.floorId}>
              {`${exitFloor.name} -> ${targetIndex >= 0 ? labels[targetIndex] : '?'}`}
            </option>
          )
        })}
      </select>
    </>
  )
}
