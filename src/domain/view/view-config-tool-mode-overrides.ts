/**
 * A drawing tool always shows the layers it works on, whatever the stored
 * view config says. The result is COMPUTED at render / export time and never
 * written back to the store, so leaving the tool restores the user's view.
 */
import { DEFAULT_VIEW_CONFIG, type ViewConfig } from './view-config-types'

/**
 * Same literals as the store's `ToolMode` (`editor-ui-store.ts`). Declared
 * here because the domain must not import `src/state`; passing the store's
 * `ToolMode` to `resolveEffectiveViewConfig` is the compile-time drift check.
 */
export type ViewConfigToolMode = 'select' | 'calibrate' | 'wall' | 'hub' | 'riser' | 'drop' | 'shaft' | 'cable' | 'trunk'

/**
 * The view config with the current tool's layers forced ON (never off).
 * Returns `config` itself when the tool forces nothing or it is already
 * satisfied.
 *
 * - `wall`: walls.
 * - `hub` / `riser` / `drop` / `shaft`: hubs.
 * - `cable`: hubs, cables and every device marker - the cable tool snaps to
 *   every camera, sensor and hub in the store, so all of them must be on
 *   screen. Cones / coverage flags are left alone (the cable tool hides them
 *   through `coverageVisible`).
 * - `trunk`: hubs and cables (the "cable routes" toggle also covers trunk
 *   lines - no separate toggle) - the trunk tool snaps only to other hubs,
 *   never a device, so no device-marker toggle needs forcing.
 */
export function resolveEffectiveViewConfig(config: ViewConfig, toolMode: ViewConfigToolMode): ViewConfig {
  switch (toolMode) {
    case 'wall':
      return config.walls ? config : { ...config, walls: true }
    case 'hub':
    case 'riser':
    case 'drop':
    case 'shaft':
      return config.hubs ? config : { ...config, hubs: true }
    case 'cable': {
      const satisfied =
        config.hubs &&
        config.cables &&
        config.cameraMarkers &&
        config.sensorMarkers &&
        Object.values(config.cameraFormFactors).every(Boolean) &&
        Object.values(config.sensorKinds).every(Boolean)
      if (satisfied) return config
      return {
        ...config,
        hubs: true,
        cables: true,
        cameraMarkers: true,
        sensorMarkers: true,
        cameraFormFactors: DEFAULT_VIEW_CONFIG.cameraFormFactors,
        sensorKinds: DEFAULT_VIEW_CONFIG.sensorKinds,
      }
    }
    case 'trunk':
      return config.hubs && config.cables ? config : { ...config, hubs: true, cables: true }
    case 'select':
    case 'calibrate':
      return config
  }
}
