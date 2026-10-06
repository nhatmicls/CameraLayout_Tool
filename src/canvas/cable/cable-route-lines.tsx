import { Line } from 'react-konva'
import { resolveCablePathPx, type CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import type { Cable, CableType } from '../../domain/cable/cable-layout-types'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import { CABLE_OVER_LIMIT_COLOR, cableTypeColor } from './cable-type-color-palette'

export interface CableRouteLinesProps {
  cables: Cable[]
  index: CableEndpointIndex
  cableTypes: CableType[]
  /** Empty when the scale is not set: no metres, so no over-length styling. */
  limitStatusById: ReadonlyMap<string, CableLimitStatus>
  /** The selected cable is drawn by `SelectedCableVertexEditor` instead. */
  hiddenCableId: string | null
  /** Image px: cable lines are plan content, like wall lines. */
  strokeWidthPx: number
  /** Only for the screen-constant click target. */
  viewportScale: number
  onSelectCable?: (id: string) => void
}

/** Screen px either side of a cable line that still counts as clicking it. */
const CABLE_HIT_WIDTH_SCREEN_PX = 12

/**
 * Every cable as one polyline in its type's colour. A cable over its type's
 * length limit is red and dashed; one that may be over (only at the top of
 * the scale-error range) keeps its colour and is dashed.
 *
 * Rendered inside the walls Layer (after the wall lines, before the wall
 * node handles): that Layer listens in select mode only - the cable rule too
 * - and its handles stay grabbable on top of a cable. A dangling cable (its
 * device or hub is gone) is skipped.
 */
export function CableRouteLines({
  cables,
  index,
  cableTypes,
  limitStatusById,
  hiddenCableId,
  strokeWidthPx,
  viewportScale,
  onSelectCable,
}: CableRouteLinesProps) {
  const dash = [5 * strokeWidthPx, 4 * strokeWidthPx]

  return (
    <>
      {cables.map((cable) => {
        if (cable.id === hiddenCableId) return null
        const path = resolveCablePathPx(cable, index)
        if (!path) return null
        const status = limitStatusById.get(cable.id)
        const typeColor = cableTypeColor(cableTypes.findIndex((type) => type.id === cable.typeId))
        return (
          <Line
            key={cable.id}
            points={path.flatMap((point) => [point.x, point.y])}
            stroke={status === 'over' ? CABLE_OVER_LIMIT_COLOR : typeColor}
            strokeWidth={strokeWidthPx}
            dash={status === 'over' || status === 'maybe-over' ? dash : undefined}
            lineJoin="round"
            lineCap="round"
            hitStrokeWidth={Math.max(strokeWidthPx, CABLE_HIT_WIDTH_SCREEN_PX / viewportScale)}
            perfectDrawEnabled={false}
            onClick={(e) => {
              e.cancelBubble = true
              onSelectCable?.(cable.id)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              onSelectCable?.(cable.id)
            }}
          />
        )
      })}
    </>
  )
}
