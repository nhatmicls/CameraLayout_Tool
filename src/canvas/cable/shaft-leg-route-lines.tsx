import { Line } from 'react-konva'
import type { CableType } from '../../domain/cable/cable-layout-types'
import type { ResolvedShaftLeg } from '../../domain/cable/shaft-cable-leg'
import { cableTypeColor } from './cable-type-color-palette'

export interface ShaftLegRouteLinesProps {
  /** Every cable leg that runs on THIS floor beyond a shaft (`findShaftLegsOnFloor`) - its cable may belong to another floor. */
  legs: readonly ResolvedShaftLeg[]
  cableTypes: CableType[]
  /** Image px: plan content, like cable lines. */
  strokeWidthPx: number
}

/**
 * The part of a cable that continues on this floor beyond a shaft: one
 * polyline per leg, from this floor's shaft opening to the leg's end, in the
 * cable's own type colour. Never clickable - a leg is drawn, redrawn and
 * removed from the shaft panel's cable list, and its cable is selected on
 * the floor it starts on. Rendered with the cable lines (walls Layer's
 * children slot), screen and PNG alike.
 */
export function ShaftLegRouteLines({ legs, cableTypes, strokeWidthPx }: ShaftLegRouteLinesProps) {
  return (
    <>
      {legs.map((leg) => (
        <Line
          key={`${leg.sourceFloorIndex}:${leg.cable.id}`}
          // Queryable by a dev-test hook (`getShaftLegLineCableIds`), independent of pixel colours.
          name={`shaft-leg-${leg.cable.id}`}
          points={leg.pathPx.flatMap((point) => [point.x, point.y])}
          stroke={cableTypeColor(cableTypes.findIndex((type) => type.id === leg.cable.typeId))}
          strokeWidth={strokeWidthPx}
          lineCap="round"
          lineJoin="round"
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  )
}
