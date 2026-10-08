import { Line } from 'react-konva'
import { resolveHubTrunkPathPx } from '../../domain/cable/hub-trunk-path'
import type { Hub } from '../../domain/cable/cable-layout-types'
import { computeTrunkDashPattern, TRUNK_LINE_COLOR } from './cable-type-color-palette'

export interface HubTrunkRouteLinesProps {
  hubs: Hub[]
  /** The selected hub's own trunk is drawn by `SelectedRouteVertexEditor` instead (while editable). */
  hiddenHubId: string | null
  /** Image px: trunk lines are plan content, like cable lines. */
  strokeWidthPx: number
}

/**
 * Every hub's own drawn route to another hub (`Hub.trunk`), dotted, neutral
 * colour, never clickable (`listening={false}` - a trunk is edited only via
 * its owner hub's selection, not by clicking the line itself). Rendered
 * ahead of `CableRouteLines` in the same fragment (`usePlanSceneCabling`),
 * so a trunk line sits under a cable line where the two cross - both are
 * plan content in the walls Layer's children slot, screen and PNG alike.
 */
export function HubTrunkRouteLines({ hubs, hiddenHubId, strokeWidthPx }: HubTrunkRouteLinesProps) {
  const dash = computeTrunkDashPattern(strokeWidthPx)

  return (
    <>
      {hubs.map((hub) => {
        if (!hub.trunk || hub.id === hiddenHubId) return null
        const path = resolveHubTrunkPathPx(hub, hubs)
        if (!path) return null
        return (
          <Line
            key={hub.id}
            // Queryable by a dev-test hook (`getTrunkRouteLineHubIds`) to confirm the PLAIN line
            // (as opposed to the editor's own) is actually mounted, independent of pixel colours.
            name={`trunk-route-${hub.id}`}
            points={path.flatMap((point) => [point.x, point.y])}
            stroke={TRUNK_LINE_COLOR}
            strokeWidth={strokeWidthPx}
            dash={dash}
            lineCap="round"
            lineJoin="round"
            listening={false}
            perfectDrawEnabled={false}
          />
        )
      })}
    </>
  )
}
