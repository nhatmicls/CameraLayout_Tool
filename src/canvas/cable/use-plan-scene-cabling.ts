import { createElement, Fragment, useMemo, type ReactNode } from 'react'
import { buildCableEndpointIndex, type CableEndpointIndex } from '../../domain/cable/cable-endpoint-index'
import type { CableLayout, CablePoint } from '../../domain/cable/cable-layout-types'
import type { CableLimitStatus } from '../../domain/cable/cable-length-estimate-calculator'
import type { PlacedFireAlarmDevice } from '../../domain/fire-alarm/fire-alarm-device-types'
import type { PlacedCamera, ScaleCalibration } from '../../domain/project-file/project-types'
import type { PlacedSensor } from '../../domain/sensor/sensor-types'
import { fireAlarmModelSpecById } from '../../export/shared/fire-alarm-compatibility-index-singleton'
import { CableRouteLines } from './cable-route-lines'
import { computeCableStrokeWidthPx } from './cable-type-color-palette'
import { HubTrunkRouteLines } from './hub-trunk-route-lines'

const NO_LIMIT_STATUSES: ReadonlyMap<string, CableLimitStatus> = new Map()

/**
 * The cable data `PlanSceneLayers` draws. `scale` is the real calibration
 * (null = no metres, so no over-length styling) - never the `?? 1` drawing
 * fallback. `limitStatusById` is this floor's own slice of the ONE project
 * cable estimate (`useCableLayoutEstimate`/`computeProjectCableEstimate`),
 * computed by the caller - this module never calls an estimate function
 * itself, so screen and PNG style over-length cables alike from the SAME
 * cross-floor-aware source. Omitted (the dev spike, tests) = nothing styled
 * as over-length.
 */
export interface PlanSceneCabling extends CableLayout {
  scale: ScaleCalibration | null
  limitStatusById?: ReadonlyMap<string, CableLimitStatus>
  /** The project's `shafts[]` ids, in order - a shaft marker's on-screen "T{n}" label needs the WHOLE project, not just this floor's own hubs (phase 6). Omitted on every pre-shaft caller/test - harmless unless this floor actually holds a shaft marker. */
  shaftIds?: readonly string[]
}

/** Editor-only wiring; omitted in the PNG export and the dev spike, where hubs and cables are a static render. */
export interface PlanSceneCablingInteraction {
  selectedHubId: string | null
  selectedCableId: string | null
  onSelectHub: (id: string) => void
  onSelectCable: (id: string) => void
  onHubDragEnd: (id: string, x: number, y: number) => void
  onCablePointsChange: (id: string, points: CablePoint[]) => void
  /** The selected hub's own trunk edited point-by-point: `hubId` is always the OWNER hub (the target hub is unchanged - looked up live, never passed back here). */
  onHubTrunkPointsChange: (hubId: string, points: CablePoint[]) => void
}

interface PlanSceneCablingInput {
  cameras: PlacedCamera[]
  sensors: PlacedSensor[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
  cabling: PlanSceneCabling
  interaction: PlanSceneCablingInteraction | undefined
  iconRadiusPx: number
  viewportScale: number
  /** Same flag `HubAndSelectedCableNodes` gates its trunk editor on (true in select mode only).
   * Determines whether the selected hub's trunk is hidden from the plain `HubTrunkRouteLines`
   * (H2 fix): hide it ONLY when the editor is actually about to draw it instead - in every other
   * tool mode (wall, calibrate, hub/riser/drop, cable, and `'trunk'` itself while redrawing) the
   * plain dotted line stays visible, so the OLD route never just disappears. Default true. */
  trunkEditingEnabled?: boolean
}

/**
 * Derived cable data shared by every mount of `PlanSceneLayers` (screen,
 * PNG export, dev spike), so all three agree: where each cable end is,
 * which cables are over / possibly over their type's length limit, and the
 * cable lines themselves.
 *
 * `cableLines` goes into `WallSegmentsLayer`'s children slot: every hub's
 * trunk line (`HubTrunkRouteLines`, dotted, drawn first so a cable line
 * paints over it where the two cross) then every cable line
 * (`CableRouteLines`). Memoised, and null without cables or trunks, so that
 * layer's memo still holds for a plain plan; with either, a camera drop
 * re-reconciles the wall lines (an end moved).
 */
export function usePlanSceneCabling({
  cameras,
  sensors,
  fireAlarmDevices,
  cabling,
  interaction,
  iconRadiusPx,
  viewportScale,
  trunkEditingEnabled = true,
}: PlanSceneCablingInput): {
  index: CableEndpointIndex
  limitStatusById: ReadonlyMap<string, CableLimitStatus>
  cableLines: ReactNode
} {
  const index = useMemo(
    () => buildCableEndpointIndex(cameras, sensors, cabling.hubs, cabling.shaftIds, { devices: fireAlarmDevices, modelById: fireAlarmModelSpecById }),
    [cameras, sensors, fireAlarmDevices, cabling.hubs, cabling.shaftIds],
  )
  const limitStatusById = cabling.limitStatusById ?? NO_LIMIT_STATUSES

  const hiddenCableId = interaction?.selectedCableId ?? null
  // The selected hub's trunk is drawn by `SelectedRouteVertexEditor` (markers Layer) instead -
  // but ONLY while that editor actually mounts (`trunkEditingEnabled`, select mode). Outside
  // select mode (including `'trunk'` mode itself, mid-redraw) this stays null, so the plain dotted
  // line keeps drawing the stored route until a new one commits (H2 fix).
  const hiddenHubId = trunkEditingEnabled ? (interaction?.selectedHubId ?? null) : null
  const onSelectCable = interaction?.onSelectCable
  const strokeWidthPx = computeCableStrokeWidthPx(iconRadiusPx)
  const hasTrunks = cabling.hubs.some((hub) => hub.trunk)
  const cableLines = useMemo(
    () =>
      cabling.cables.length === 0 && !hasTrunks
        ? null
        : createElement(
            Fragment,
            null,
            createElement(HubTrunkRouteLines, { hubs: cabling.hubs, hiddenHubId, strokeWidthPx }),
            cabling.cables.length === 0
              ? null
              : createElement(CableRouteLines, {
                  cables: cabling.cables,
                  index,
                  cableTypes: cabling.cableTypes,
                  limitStatusById,
                  hiddenCableId,
                  strokeWidthPx,
                  viewportScale,
                  onSelectCable,
                }),
          ),
    [cabling.cables, cabling.cableTypes, cabling.hubs, hasTrunks, index, limitStatusById, hiddenCableId, hiddenHubId, strokeWidthPx, viewportScale, onSelectCable],
  )

  return { index, limitStatusById, cableLines }
}
