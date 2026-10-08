import { hubLabels } from '../../domain/cable/cable-endpoint-index'
import { sumFloorHeightsBetween } from '../../domain/cable/cross-floor-hub-beyond-length-resolver'
import { resolveHubTrunkPathPx } from '../../domain/cable/hub-trunk-path'
import { polylineLengthPx } from '../../domain/cable/cable-length-estimate-calculator'
import { formatMeters } from '../../domain/cable/cable-length-format'
import type { ShaftMarkerRef } from '../../domain/cable/shaft-integrity'
import { planPxToMeters } from '../../domain/shared/scale-calibration-calculator'
import type { Floor } from '../../domain/floor/floor-types'

/** One exit's own route length, metres, measured on its OWN floor's scale - null when that floor has no scale. */
function exitRouteLengthM(floor: Floor, exitHub: ShaftMarkerRef['hub']): number | null {
  if (!floor.scale || !exitHub.trunk) return null
  const path = resolveHubTrunkPathPx(exitHub, floor.hubs)
  if (!path) return null
  return planPxToMeters(polylineLengthPx(path), floor.scale.planPxPerMeter)
}

/** "F1 3.5 + F2 3.5" - every floor's own `floorHeightM` strictly between the two indices, named. Order-independent, same floors `sumFloorHeightsBetween` itself sums. */
function floorHeightBreakdown(floors: readonly Floor[], fromIndex: number, toIndex: number): string {
  const lo = Math.min(fromIndex, toIndex)
  const hi = Math.max(fromIndex, toIndex)
  const parts: string[] = []
  for (let i = lo; i < hi; i++) parts.push(`${floors[i].name} ${floors[i].floorHeightM.toFixed(1)}`)
  return parts.join(' + ')
}

interface ShaftExitListProps {
  floors: Floor[]
  shaftIds: string[]
  /** The SELECTED marker's own floor index - the vertical breakdown is "from here". */
  floorIndex: number
  exits: ShaftMarkerRef[]
}

/** The shaft panel's exits list ("F3 -> H2, route 6.0 m") + the vertical-from-here breakdown ("To F3: 7.0 m = F1 3.5 + F2 3.5") - split out of `shaft-properties-section.tsx` to keep that file under 200 lines. */
export function ShaftExitList({ floors, shaftIds, floorIndex, exits }: ShaftExitListProps) {
  if (exits.length === 0) {
    return (
      <p data-testid="shaft-no-exit-note" className="mt-1 text-xs text-amber-600">
        No exit route yet - typed length in use.
      </p>
    )
  }

  return (
    <>
      <ul className="mt-1 space-y-0.5 text-xs text-neutral-600">
        {exits.map((exit) => {
          const exitFloor = floors[exit.floorIndex]
          const labels = hubLabels(exitFloor.hubs, shaftIds)
          const targetIndex = exitFloor.hubs.findIndex((candidate) => candidate.id === exit.hub.trunk!.hubId)
          const routeM = exitRouteLengthM(exitFloor, exit.hub)
          return (
            <li key={exit.floorId} data-testid={`shaft-exit-${exit.floorId}`}>
              {`${exitFloor.name} -> ${targetIndex >= 0 ? labels[targetIndex] : '?'}, route ${routeM === null ? 'no scale' : formatMeters(routeM)}`}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-tight text-neutral-500" data-testid="shaft-vertical-from-here">
        {exits
          .map((exit) => {
            const totalM = sumFloorHeightsBetween(floors, floorIndex, exit.floorIndex)
            const breakdown = floorHeightBreakdown(floors, floorIndex, exit.floorIndex)
            return `To ${floors[exit.floorIndex].name}: ${formatMeters(totalM)}${breakdown ? ` = ${breakdown}` : ''}`
          })
          .join('; ')}
      </p>
    </>
  )
}
