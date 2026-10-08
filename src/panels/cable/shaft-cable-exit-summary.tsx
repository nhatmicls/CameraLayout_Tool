import { useState } from 'react'
import { summariseShaftCables } from '../../domain/cable/shaft-cable-exit-cascade'
import type { Floor } from '../../domain/floor/floor-types'
import { useProjectStore } from '../../state/project-store'
import { secondaryButtonClass } from '../camera/camera-properties-form-helpers'

interface ShaftCableExitSummaryProps {
  floors: Floor[]
  shaftIds: string[]
  shaftId: string
  /** The selected marker's own floor + hub - bulk assign operates on "the cables on THIS floor without an exit". */
  floorId: string
  hubId: string
}

/**
 * The shaft panel's "in = out" summary (every cable entering the shaft, how
 * many leave at each exit, how many are stuck with no exit chosen - red
 * unless 0) plus the bulk "assign the N cables on this floor without an
 * exit" control, shown only once the shaft actually has 2+ exits (with 0 or
 * 1, every cable already resolves without a choice).
 */
export function ShaftCableExitSummary({ floors, shaftIds, shaftId, floorId, hubId }: ShaftCableExitSummaryProps) {
  const assignShaftCableExits = useProjectStore((s) => s.assignShaftCableExits)
  const [bulkExit, setBulkExit] = useState('')

  const summary = summariseShaftCables(floors, shaftIds, shaftId)
  const floor = floors.find((candidate) => candidate.id === floorId)
  const exitFloorIds = new Set(summary.perExit.map((exit) => exit.floorId))
  const cablesOnThisFloorWithoutExit =
    summary.perExit.length >= 2 && floor
      ? floor.cables.filter((cable) => cable.hubId === hubId && !(cable.exitFloorId !== undefined && exitFloorIds.has(cable.exitFloorId))).length
      : 0

  const handleAssign = () => {
    if (!bulkExit) return
    assignShaftCableExits(floorId, hubId, bulkExit)
    setBulkExit('')
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <p className="text-xs font-medium text-neutral-700">Cables</p>
      <p data-testid="shaft-cables-in" className="mt-1 text-xs text-neutral-600">
        Cables in: {summary.cablesIn}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-neutral-600">
        {summary.perExit.map((exit) => (
          <li key={exit.floorId} data-testid={`shaft-exit-count-${exit.floorId}`}>
            {`Out at ${exit.floorName} -> ${exit.targetHubLabel}: ${exit.count}`}
          </li>
        ))}
      </ul>
      <p data-testid="shaft-not-chosen-count" className={`mt-1 text-xs font-medium ${summary.notChosen > 0 ? 'text-red-600' : 'text-green-700'}`}>
        No exit chosen: {summary.notChosen}
      </p>

      {cablesOnThisFloorWithoutExit > 0 && (
        <div className="mt-2 space-y-1">
          <label className="block text-[11px] text-neutral-600" htmlFor="shaft-bulk-assign-select">
            {`Assign the ${cablesOnThisFloorWithoutExit} cable${cablesOnThisFloorWithoutExit === 1 ? '' : 's'} on this floor without an exit to:`}
          </label>
          <div className="flex items-center gap-1">
            <select
              id="shaft-bulk-assign-select"
              data-testid="shaft-bulk-assign-select"
              value={bulkExit}
              onChange={(e) => setBulkExit(e.target.value)}
              className="min-w-0 flex-1 rounded border border-neutral-300 px-1 py-1 text-xs text-neutral-700"
            >
              <option value="">Choose...</option>
              {summary.perExit.map((exit) => (
                <option key={exit.floorId} value={exit.floorId}>{`${exit.floorName} -> ${exit.targetHubLabel}`}</option>
              ))}
            </select>
            <button
              type="button"
              data-testid="shaft-bulk-assign-button"
              disabled={!bulkExit}
              onClick={handleAssign}
              className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Assign
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
