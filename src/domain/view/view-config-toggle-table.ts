/**
 * The ONE ordered table of view toggles. The right-panel View section, its
 * "N hidden" badge and the PNG strip's "Shown / Hidden" note all walk this
 * table, so a label or a toggle can never exist in one place and not the
 * others.
 */
import { SENSOR_KIND_DISPLAY_ORDER, SENSOR_KIND_LABELS, type SensorKind } from '../sensor/sensor-types'
import { VIEW_CAMERA_FORM_FACTORS, type ViewCameraFormFactor, type ViewConfig } from './view-config-types'

export type ViewToggleGroup = 'cameras' | 'sensors' | 'cabling' | 'walls'

export type ViewToggleFlag = 'cameraMarkers' | 'cameraCones' | 'sensorMarkers' | 'sensorCoverage' | 'hubs' | 'cables' | 'walls'

export type ViewToggleKey = { flag: ViewToggleFlag } | { formFactor: ViewCameraFormFactor } | { sensorKind: SensorKind }

export interface ViewToggleDefinition {
  /** Stable id, used for the React key and the checkbox `data-testid`. */
  id: string
  group: ViewToggleGroup
  key: ViewToggleKey
  /** Row label in the View panel, e.g. "Dome". */
  panelLabel: string
  /** Lower-case label in the PNG note, e.g. "dome cameras". */
  noteLabel: string
}

export const VIEW_TOGGLE_GROUP_LABELS: Record<ViewToggleGroup, string> = {
  cameras: 'Cameras',
  sensors: 'Sensors',
  cabling: 'Cabling',
  walls: 'Walls',
}

const FORM_FACTOR_PANEL_LABELS: Record<ViewCameraFormFactor, string> = {
  bullet: 'Bullet',
  dome: 'Dome',
  turret: 'Turret',
  ptz: 'PTZ',
  fisheye: 'Fisheye',
}

const SENSOR_KIND_NOTE_LABELS: Record<SensorKind, string> = {
  pir: 'PIR sensors',
  beam: 'IR beams',
  vibration: 'vibration sensors',
  thermal: 'thermal cameras',
}

/** The 16 toggles, in panel order. */
export const VIEW_TOGGLES: readonly ViewToggleDefinition[] = [
  { id: 'camera-markers', group: 'cameras', key: { flag: 'cameraMarkers' }, panelLabel: 'Markers', noteLabel: 'camera markers' },
  { id: 'camera-cones', group: 'cameras', key: { flag: 'cameraCones' }, panelLabel: 'FOV cones', noteLabel: 'FOV cones' },
  ...VIEW_CAMERA_FORM_FACTORS.map(
    (formFactor): ViewToggleDefinition => ({
      id: `camera-${formFactor}`,
      group: 'cameras',
      key: { formFactor },
      panelLabel: FORM_FACTOR_PANEL_LABELS[formFactor],
      noteLabel: `${formFactor === 'ptz' ? 'PTZ' : formFactor} cameras`,
    }),
  ),
  { id: 'sensor-markers', group: 'sensors', key: { flag: 'sensorMarkers' }, panelLabel: 'Markers and beam lines', noteLabel: 'sensor markers' },
  { id: 'sensor-coverage', group: 'sensors', key: { flag: 'sensorCoverage' }, panelLabel: 'Coverage', noteLabel: 'sensor coverage' },
  ...SENSOR_KIND_DISPLAY_ORDER.map(
    (sensorKind): ViewToggleDefinition => ({
      id: `sensor-${sensorKind}`,
      group: 'sensors',
      key: { sensorKind },
      panelLabel: SENSOR_KIND_LABELS[sensorKind],
      noteLabel: SENSOR_KIND_NOTE_LABELS[sensorKind],
    }),
  ),
  { id: 'hubs', group: 'cabling', key: { flag: 'hubs' }, panelLabel: 'Hubs, risers, drops, shafts', noteLabel: 'hubs' },
  { id: 'cables', group: 'cabling', key: { flag: 'cables' }, panelLabel: 'Cables', noteLabel: 'cables' },
  { id: 'walls', group: 'walls', key: { flag: 'walls' }, panelLabel: 'Walls', noteLabel: 'walls' },
]

export function isViewToggleOn(config: ViewConfig, key: ViewToggleKey): boolean {
  if ('flag' in key) return config[key.flag]
  if ('formFactor' in key) return config.cameraFormFactors[key.formFactor]
  return config.sensorKinds[key.sensorKind]
}

/** A new config with that one toggle set; never mutates `config` (the default is frozen). */
export function withViewToggle(config: ViewConfig, key: ViewToggleKey, on: boolean): ViewConfig {
  if ('flag' in key) return { ...config, [key.flag]: on }
  if ('formFactor' in key) return { ...config, cameraFormFactors: { ...config.cameraFormFactors, [key.formFactor]: on } }
  return { ...config, sensorKinds: { ...config.sensorKinds, [key.sensorKind]: on } }
}

/** A parent checkbox over a set of toggles: every one on, every one off, or a mix. */
export type ViewToggleSetState = 'all' | 'some' | 'none'

/**
 * State of a parent checkbox over `toggles` - a whole group ("Cameras") or
 * a group's type rows ("Types": the form factors, "Kinds": the sensor kinds).
 */
export function viewToggleSetState(config: ViewConfig, toggles: readonly ViewToggleDefinition[]): ViewToggleSetState {
  const onCount = toggles.filter((toggle) => isViewToggleOn(config, toggle.key)).length
  if (onCount === toggles.length) return 'all'
  return onCount === 0 ? 'none' : 'some'
}

/** A new config with EVERY toggle in `toggles` set - what ticking / unticking their parent checkbox does. Toggles outside the set are untouched. */
export function withViewToggleSet(config: ViewConfig, toggles: readonly ViewToggleDefinition[], on: boolean): ViewConfig {
  return toggles.reduce((next, toggle) => withViewToggle(next, toggle.key, on), config)
}

/** True for a per-form-factor / per-sensor-kind row - the rows under a group's "Types" / "Kinds" parent. A `flag` row sits directly under the group. */
export function isViewTypeToggle(toggle: ViewToggleDefinition): boolean {
  return !('flag' in toggle.key)
}

/** How many of the 16 toggles are off (0 = everything is shown). */
export function countHiddenViewToggles(config: ViewConfig): number {
  return VIEW_TOGGLES.filter((toggle) => !isViewToggleOn(config, toggle.key)).length
}

export interface ViewFilterNote {
  /** e.g. "Shown: camera markers, FOV cones, walls". */
  shownText: string
  /** e.g. "Hidden: cables, dome cameras". */
  hiddenText: string
}

/** The PNG strip's note, in table order. Null when every toggle is on (the export then draws no note at all). */
export function buildViewFilterNote(config: ViewConfig): ViewFilterNote | null {
  const shown: string[] = []
  const hidden: string[] = []
  for (const toggle of VIEW_TOGGLES) (isViewToggleOn(config, toggle.key) ? shown : hidden).push(toggle.noteLabel)
  if (hidden.length === 0) return null
  return { shownText: `Shown: ${shown.length > 0 ? shown.join(', ') : 'none'}`, hiddenText: `Hidden: ${hidden.join(', ')}` }
}
