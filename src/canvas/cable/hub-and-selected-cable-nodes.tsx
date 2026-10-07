import type { CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import { CABLE_OVER_LIMIT_COLOR, cableTypeColor, computeCableStrokeWidthPx } from './cable-type-color-palette'
import { HubMarkerNode } from './hub-marker-node'
import { SelectedCableVertexEditor } from './selected-cable-vertex-editor'
import type { PlanSceneCabling, PlanSceneCablingInteraction } from './use-plan-scene-cabling'

export interface HubAndSelectedCableNodesProps {
  cabling: PlanSceneCabling
  index: CableEndpointIndex
  limitStatusById: ReadonlyMap<string, CableLimitStatus>
  /** Omitted in the PNG export: hubs become a static render and no cable is selected. */
  interaction?: PlanSceneCablingInteraction
  /** False (view config) draws no hub / riser / drop marker; cables still end at the hub position. Default true. */
  hubsVisible?: boolean
  /** False (view config) draws no vertex editor for the selected cable. Default true. */
  cablesVisible?: boolean
  iconRadiusPx: number
  viewportScale: number
  imageWidthPx: number
  imageHeightPx: number
}

/**
 * The cable feature's share of the markers Layer: every hub / riser marker
 * (labels from the endpoint index: `H{n}` / `R{n}`), then - last, so it is on top
 * - the selected cable with its vertex handles. Adds no Konva Layer.
 */
export function HubAndSelectedCableNodes({
  cabling,
  index,
  limitStatusById,
  interaction,
  hubsVisible = true,
  cablesVisible = true,
  iconRadiusPx,
  viewportScale,
  imageWidthPx,
  imageHeightPx,
}: HubAndSelectedCableNodesProps) {
  // Looked up rather than trusted: an undo can remove the cable while its id is still selected.
  const selectedCable = interaction ? cabling.cables.find((cable) => cable.id === interaction.selectedCableId) : undefined
  const selectedStatus = selectedCable ? limitStatusById.get(selectedCable.id) : undefined
  const selectedColor =
    selectedStatus === 'over'
      ? CABLE_OVER_LIMIT_COLOR
      : cableTypeColor(cabling.cableTypes.findIndex((type) => type.id === selectedCable?.typeId))

  return (
    <>
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
      {interaction && selectedCable && cablesVisible && (
        <SelectedCableVertexEditor
          key={selectedCable.id}
          cable={selectedCable}
          index={index}
          color={selectedColor}
          dashed={selectedStatus === 'over' || selectedStatus === 'maybe-over'}
          strokeWidthPx={computeCableStrokeWidthPx(iconRadiusPx)}
          viewportScale={viewportScale}
          imageWidthPx={imageWidthPx}
          imageHeightPx={imageHeightPx}
          onPointsChange={interaction.onCablePointsChange}
        />
      )}
    </>
  )
}
