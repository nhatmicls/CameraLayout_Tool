import { Text } from 'react-konva'
import { computeCableLabelAnchor } from '../../domain/cable/cable-label-anchor'
import type { CablePoint } from '../../domain/cable/cable-layout-types'

export interface CableRouteLabelItem {
  /** React list key - unique across both cable lines and shaft legs (a leg's cable id may repeat another floor's). */
  key: string
  /** Konva node name, queryable by a dev-test hook: `cable-label-<cableId>` for a cable line, `shaft-leg-label-<cableId>` for a leg. */
  name: string
  pathPx: readonly CablePoint[]
  /** The cable's own end-to-end label ("F1_C3_F2_H1"); the item is skipped (by the caller) when this is empty. */
  text: string
}

export interface CableRouteLabelsProps {
  items: readonly CableRouteLabelItem[]
  /** Image px - zoom-capped on screen, plain on the PNG (`computeCableLabelFontSizePx`). */
  fontSizePx: number
  /** The line it labels own stroke width, image px - sets how far off the line the text sits. */
  strokeWidthPx: number
}

/**
 * ONE label per cable line or shaft leg (DRY - the same component draws
 * both): positioned 40% along its own path (`computeCableLabelAnchor`),
 * upright, offset off the line by half its stroke plus a bit of text
 * height, with a white halo so it stays legible over any line colour or
 * crossing line beneath it. Never clickable (`listening={false}`) - it can
 * never cover a marker or steal a click meant for the line/marker below it.
 */
export function CableRouteLabels({ items, fontSizePx, strokeWidthPx }: CableRouteLabelsProps) {
  const offsetPx = strokeWidthPx / 2 + fontSizePx * 0.7

  return (
    <>
      {items.map((item) => {
        const anchor = computeCableLabelAnchor(item.pathPx)
        if (!anchor) return null
        return (
          <Text
            key={item.key}
            name={item.name}
            text={item.text}
            x={anchor.x + anchor.normalX * offsetPx}
            y={anchor.y + anchor.normalY * offsetPx}
            rotation={anchor.angleDeg}
            offsetX={item.text.length * fontSizePx * 0.3}
            offsetY={fontSizePx / 2}
            fontSize={fontSizePx}
            fill="#111827"
            stroke="#ffffff"
            strokeWidth={fontSizePx * 0.25}
            fillAfterStrokeEnabled
            listening={false}
            perfectDrawEnabled={false}
          />
        )
      })}
    </>
  )
}
