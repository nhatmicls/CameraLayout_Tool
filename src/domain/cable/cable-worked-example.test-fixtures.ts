import type { PlacedCamera, ScaleCalibration } from '../project-file/project-types'
import type { PlacedBeamSensor, PlacedSectorSensor } from '../sensor/sensor-types'
import { createEmptyCableLayout, type Cable, type CableType, type Hub } from './cable-layout-types'
import type { CableLayoutEstimateInput } from './cable-layout-estimate'

/**
 * The worked example every cable test shares (test-only module): a 400 px
 * reference line of 4 m => 100 px/m, two cameras on one hub, default
 * allowances (click error 3 px => factors 400/406 and 400/394).
 *
 * Cable A: 1000 px => 10 m horizontal, fixed 5.5 m, run 15.5 m, purchase 17.825 m.
 * Cable B: hypot(600, 200) px => 6.324555 m, fixed 5 m, run 11.324555 m, purchase 13.023239 m.
 */

export const SCALE_100_PX_PER_M: ScaleCalibration = {
  planPxPerMeter: 100,
  refLine: { x1: 0, y1: 0, x2: 400, y2: 0 },
  refLengthM: 4,
}

export const CAMERA_C1: PlacedCamera = { id: 'cam-1', modelId: 'm', x: 100, y: 100, rotationDeg: 0, rangeM: 10, mountHeightM: 2.5, tiltDeg: 20 }
export const CAMERA_C2: PlacedCamera = { id: 'cam-2', modelId: 'm', x: 100, y: 300, rotationDeg: 0, rangeM: 10 }
export const PIR_S1: PlacedSectorSensor = { id: 'pir-1', modelId: 'p', shape: 'sector', x: 50, y: 50, rotationDeg: 0, rangeM: 10 }
export const BEAM_S2: PlacedBeamSensor = { id: 'beam-1', modelId: 'b', shape: 'beam', x: 200, y: 600, x2: 500, y2: 600, environment: 'indoor' }
export const HUB_H1: Hub = { id: 'hub-1', x: 700, y: 500, mountHeightM: 1.5 }

export const CABLE_A: Cable = {
  id: 'cable-a',
  device: { kind: 'camera', id: 'cam-1' },
  hubId: 'hub-1',
  typeId: 'cat6-utp',
  points: [
    { x: 400, y: 100 },
    { x: 400, y: 500 },
  ],
}
export const CABLE_B: Cable = { id: 'cable-b', device: { kind: 'camera', id: 'cam-2' }, hubId: 'hub-1', typeId: 'cat6-utp', points: [] }

/** The worked-example project; `cat6PricePerMeterVnd` prices the Cat6 type (null = price on request). */
export function workedExampleInput(cat6PricePerMeterVnd: number | null = 8000): CableLayoutEstimateInput {
  const layout = createEmptyCableLayout()
  return {
    ...layout,
    cameras: [CAMERA_C1, CAMERA_C2],
    sensors: [],
    hubs: [HUB_H1],
    cables: [CABLE_A, CABLE_B],
    cableTypes: layout.cableTypes.map((type): CableType => (type.id === 'cat6-utp' ? { ...type, pricePerMeterVnd: cat6PricePerMeterVnd } : type)),
    scale: SCALE_100_PX_PER_M,
  }
}
