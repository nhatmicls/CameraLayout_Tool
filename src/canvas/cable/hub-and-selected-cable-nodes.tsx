import type { CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import { resolveCablePathPx } from '../../domain/cable/cable-endpoint-index'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import type { CablePoint, Hub } from '../../domain/cable/cable-layout-types'
import {
  CABLE_OVER_LIMIT_COLOR,
  cableTypeColor,
  computeCableOverLimitDashPattern,
  computeCableStrokeWidthPx,
  computeTrunkDashPattern,
  TRUNK_LINE_COLOR,
} from './cable-type-color-palette'
import { HubMarkerNode } from './hub-marker-node'
import { SelectedRouteVertexEditor } from './selected-route-vertex-editor'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from './use-plan-scene-cabling'

export interface HubAndSelectedCableNodesProps {
  cabling: PlanSceneCabling
  index: CableEndpointIndex
  limitStatusById: ReadonlyMap<string, CableLimitStatus>
  /** Omitted in the PNG export: hubs become a static render and no cable/hub is selected. */
  interaction?: PlanSceneCablingInteraction
  /** False (view config) draws no hub / riser / drop marker; cables still end at the hub position. Default true. */
  hubsVisible?: boolean
  /** False (view config) draws no vertex editor for the selected cable/trunk. Default true. */
  cablesVisible?: boolean
  /** False while the trunk-drawing tool is active: a route is being drawn fresh for the selected
   * hub, so its OWN handles editor stays off (point editing only makes sense on an already-committed
   * route, in select mode) - the drawing overlay is the only thing drawn for it meanwhile. Default true. */
  trunkEditingEnabled?: boolean
  iconRadiusPx: number
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
}

/** `selectedHub`'s own trunk, narrowed once so neither caller nor JSX needs a `!` assertion. `null` when nothing qualifies (no selection, no trunk, or the target hub is gone). */
function resolveSelectedTrunkRoute(
  hubs: Hub[],
  selectedHubId: string | null | undefined,
): { owner: Hub; points: CablePoint[]; target: Hub } | null {
  const owner = selectedHubId ? hubs.find((hub) => hub.id === selectedHubId) : undefined
  const trunk = owner?.trunk
  if (!owner || !trunk) return null
  const target = hubs.find((hub) => hub.id === trunk.hubId)
  if (!target) return null
  return { owner, points: trunk.points, target }
}

/**
 * The cable feature's share of the markers Layer. Paint order, deliberately
 * NOT "every hub marker, then the editor(s)": BOTH the selected hub's own
 * trunk editor and the selected cable's editor mount FIRST (so hub markers
 * draw ON TOP of them) - either editor's line runs end-to-end between two
 * markers with a wide `hitStrokeWidth` and round caps, so mounted after
 * `hubsVisible`'s `.map` it would sit on top of and swallow clicks/drags
 * meant for the hub marker at that end. Confirmed for both: the trunk editor
 * (H1 - the owner hub couldn't be dragged, its target hub couldn't be
 * clicked) and, once checked, the cable editor too (a selected cable ending
 * on a hub made that hub equally undraggable - same pattern, same fix, see
 * the phase report).
 */
export function HubAndSelectedCableNodes({
  cabling,
  index,
  limitStatusById,
  interaction,
  hubsVisible = true,
  cablesVisible = true,
  trunkEditingEnabled = true,
  iconRadiusPx,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
}: HubAndSelectedCableNodesProps) {
  const strokeWidthPx = computeCableStrokeWidthPx(iconRadiusPx)

  const trunkRoute = resolveSelectedTrunkRoute(cabling.hubs, interaction?.selectedHubId)
  // Typed as the route itself (not a boolean) so the JSX below narrows `showTrunkEditor` directly, no `!` needed.
  const showTrunkEditor = interaction && trunkEditingEnabled && cablesVisible ? trunkRoute : null

  // Looked up rather than trusted: an undo can remove the cable while its id is still selected.
  const selectedCable = interaction ? cabling.cables.find((cable) => cable.id === interaction.selectedCableId) : undefined
  const selectedStatus = selectedCable ? limitStatusById.get(selectedCable.id) : undefined
  const selectedCableColor =
    selectedStatus === 'over'
      ? CABLE_OVER_LIMIT_COLOR
      : cableTypeColor(cabling.cableTypes.findIndex((type) => type.id === selectedCable?.typeId))
  const cablePath = selectedCable ? resolveCablePathPx(selectedCable, index) : null

  return (
    <>
      {interaction && showTrunkEditor && (
        <SelectedRouteVertexEditor
          key={showTrunkEditor.owner.id}
          routeId={showTrunkEditor.owner.id}
          points={showTrunkEditor.points}
          startPx={{ x: showTrunkEditor.owner.x, y: showTrunkEditor.owner.y }}
          endPx={{ x: showTrunkEditor.target.x, y: showTrunkEditor.target.y }}
          color={TRUNK_LINE_COLOR}
          dash={computeTrunkDashPattern(strokeWidthPx)}
          strokeWidthPx={strokeWidthPx}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onPointsChange={interaction.onHubTrunkPointsChange}
        />
      )}
      {interaction && selectedCable && cablePath && cablesVisible && (
        <SelectedRouteVertexEditor
          key={selectedCable.id}
          routeId={selectedCable.id}
          points={selectedCable.points}
          startPx={cablePath[0]}
          endPx={cablePath[cablePath.length - 1]}
          color={selectedCableColor}
          dash={selectedStatus === 'over' || selectedStatus === 'maybe-over' ? computeCableOverLimitDashPattern(strokeWidthPx) : undefined}
          strokeWidthPx={strokeWidthPx}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onPointsChange={interaction.onCablePointsChange}
        />
      )}
      {(hubsVisible ? cabling.hubs : []).map((hub) => (
        <HubMarkerNode
          key={hub.id}
          hub={hub}
          label={index.hubById.get(hub.id)?.label ?? ''}
          iconRadiusPx={iconRadiusPx}
          selected={hub.id === interaction?.selectedHubId}
          interactive={interaction !== undefined}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onSelect={interaction?.onSelectHub}
          onDragEnd={interaction?.onHubDragEnd}
        />
      ))}
    </>
  )
}
