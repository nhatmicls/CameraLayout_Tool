/**
 * Domain type for one floor of a multi-floor project (schema v7): its own
 * floor-plan image, scale, placed cameras/sensors/fire-alarm devices, walls
 * and cabling. Pure data + one factory only - no React/Konva/`src/catalog`
 * imports (enforced by `no-react-konva-imports.test.ts`).
 *
 * `Project.fireAlarmSettings` stays PROJECT-level (one coverage-mode setting
 * for the whole building, next to `cableTypes`/`cableSettings`) - only the
 * placed `fireAlarmDevices` live per floor, mirroring `cameras`/`sensors`.
 * See the plan's drift addendum (multi-floor-project) for the rationale.
 */
import type { Cable, Hub } from '../cable/cable-layout-types'
import type { PlacedFireAlarmDevice } from '../fire-alarm/fire-alarm-device-types'
import type { PlacedCamera, PlanImage, ScaleCalibration, Wall } from '../project-file/project-types'
import type { PlacedSensor } from '../sensor/sensor-types'

export const MAX_FLOORS = 20
export const FLOOR_NAME_MAX_LENGTH = 40
export const DEFAULT_FLOOR_HEIGHT_M = 3.5
/** Floor-to-floor height bounds, metres. The top floor's value is unused (nothing rises above it). */
export const FLOOR_HEIGHT_BOUNDS = { min: 0.5, max: 30 }

/**
 * The single floor's id/name a legacy (pre-v7) flat file is wrapped into
 * (`project-file-legacy-flat-migration.ts`). Phase 1 also had the still-flat
 * store's save bridge write this id/name back out; phase 2 removed that
 * bridge (the store now holds the real multi-floor `Project` shape), so
 * only the legacy-migration reader uses this constant pair today.
 */
export const LEGACY_FLOOR_ID = 'floor-1'
export const LEGACY_FLOOR_NAME = 'Floor 1'

/**
 * One floor. `image: null` means no plan has been loaded yet for this floor -
 * in that state `scale` must be null and every placed-item array empty
 * (enforced by the v7 schema's refine, `project-file-floor-schema.ts`); the
 * app never creates anything else.
 */
export interface Floor {
  id: string
  name: string
  /** Height (m) from this floor to the next one up, user-editable, bounds `FLOOR_HEIGHT_BOUNDS`. */
  floorHeightM: number
  image: PlanImage | null
  scale: ScaleCalibration | null
  cameras: PlacedCamera[]
  walls: Wall[]
  sensors: PlacedSensor[]
  hubs: Hub[]
  cables: Cable[]
  fireAlarmDevices: PlacedFireAlarmDevice[]
}

/** A fresh, empty floor with no image yet. Fresh arrays each call - no two floors ever share one mutable reference. */
export function createEmptyFloor(id: string, name: string): Floor {
  return {
    id,
    name,
    floorHeightM: DEFAULT_FLOOR_HEIGHT_M,
    image: null,
    scale: null,
    cameras: [],
    walls: [],
    sensors: [],
    hubs: [],
    cables: [],
    fireAlarmDevices: [],
  }
}
