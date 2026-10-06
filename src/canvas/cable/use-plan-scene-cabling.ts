import { createElement, useMemo, type ReactNode } from 'react'
import { buildCableEndpointIndex, type CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import { computeCableLayoutEstimate } from '../../domain/cable/cable-layout-estimate'
import type { CableLayout, CablePoint } from '../../domain/cable/cable-layout-types'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import type { PlacedCamera, ScaleCalibration } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { CableRouteLines } from './cable-route-lines'
import { computeCableStrokeWidthPx } from './cable-type-color-palette'

/** The cable data `PlanSceneLayers` draws. `scale` is the real calibration (null = no metres, so no over-length styling) - never the `?? 1` drawing fallback. */
export interface PlanSceneCabling extends CableLayout {
  scale: ScaleCalibration | null
}

/** Editor-only wiring; omitted in the PNG export and the dev spike, where hubs and cables are a static render. */
export interface PlanSceneCablingInteraction {
  selectedHubId: string | null
  selectedCableId: string | null
  onSelectHub: (id: string) => void
  onSelectCable: (id: string) => void
  onHubDragEnd: (id: string, x: number, y: number) => void
  onCablePointsChange: (id: string, points: CablePoint[]) => void
}

interface PlanSceneCablingInput {
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
  cabling: PlanSceneCabling
  interaction: PlanSceneCablingInteraction | undefined
  iconRadiusPx: number
  viewportScale: number
}

/**
 * Derived cable data shared by every mount of `PlanSceneLayers` (screen,
 * PNG export, dev spike), so all three agree: where each cable end is,
 * which cables are over / possibly over their type's length limit, and the
 * cable lines themselves.
 *
 * `cableLines` goes into `WallSegmentsLayer`'s children slot. It is
 * memoised, and null without cables, so that layer's memo still holds for a
 * cable-free plan; with cables, a camera drop re-reconciles the wall lines
 * (the cable ends moved).
 */
export function usePlanSceneCabling({ cameras, sensors, cabling, interaction, iconRadiusPx, viewportScale }: PlanSceneCablingInput): {
  index: CableEndpointIndex
  limitStatusById: ReadonlyMap<string, CableLimitStatus>
  cableLines: ReactNode
} {
  const index = useMemo(() => buildCableEndpointIndex(cameras, sensors, cabling.hubs), [cameras, sensors, cabling.hubs])

  const limitStatusById = useMemo(() => {
    const statuses = new Map<string, CableLimitStatus>()
    if (cabling.cables.length === 0) return statuses
    for (const cable of computeCableLayoutEstimate({ ...cabling, cameras, sensors }).cables) {
      statuses.set(cable.cableId, cable.limitStatus)
    }
    return statuses
  }, [cameras, sensors, cabling])

  const hiddenCableId = interaction?.selectedCableId ?? null
  const onSelectCable = interaction?.onSelectCable
  const cableLines = useMemo(
    () =>
      cabling.cables.length === 0
        ? null
        : createElement(CableRouteLines, {
            cables: cabling.cables,
            index,
            cableTypes: cabling.cableTypes,
            limitStatusById,
            hiddenCableId,
            strokeWidthPx: computeCableStrokeWidthPx(iconRadiusPx),
            viewportScale,
            onSelectCable,
          }),
    [cabling.cables, cabling.cableTypes, index, limitStatusById, hiddenCableId, iconRadiusPx, viewportScale, onSelectCable],
  )

  return { index, limitStatusById, cableLines }
}
