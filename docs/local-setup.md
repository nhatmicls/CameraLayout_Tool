# Local setup

How to install, run and test the app on your own machine.

## Prerequisites

- Node 20.19.x (or >=22.12) and npm 10.x

## Setup

```bash
npm ci
npm run dev
```

On Windows, `npm ci` fails with `EPERM ... unlink ... .node` if a dev server from this project
is still running - stop it first.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then build the static production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only, no emit |
| `npm run lint` | ESLint over the whole project |
| `npm test` | Run unit tests (Vitest, pure logic only) |
| `npm run test:e2e` | Run end-to-end smoke tests (Playwright, Chromium, starts the dev server on port 4173) |

## Project layout

| Path | Contents |
|---|---|
| `data/` | Catalog JSON: `data/<brand>/<device-type>/<brand>-<device-type>_<NN>.json`; device type = `camera-<form factor>`, `sensor-<kind>`, or `fire-alarm-<kind>` (control-panel, wireless-hub, expander-module, keypad, keyfob, tag-reader, relay-module, repeater, communicator, power-supply, accessory, smoke-detector, heat-detector, co-detector, manual-call-point, sounder, magnetic-contact, environment-detector, intrusion-detector) |
| `src/catalog/` | Zod schemas and loaders for the camera, sensor and fire-alarm catalogs |
| `src/domain/` | Pure logic: FOV geometry, DORI distances, mounted-camera floor coverage, sensor coverage (resolver, thermal bands, beam line check, wall-blocking table), fire-alarm coverage (resolver, TCVN 5738 table, wall-blocking table), wall visibility geometry (occlusion polygon, endpoint snap, crossing detection), cable layout (types, length + range estimate, snap lookup, drawing chain, vertex editing, cross-floor link and shaft models), compatibility checker (fire devices), floor list editing (add/delete/rename/reorder), scale, BOM grouping (merged across floors), CSV, project file schema, view config (toggles, hidden-id sets, tool-layer forcing) (no React/Konva imports) |
| `src/canvas/` | Konva stage, pan/zoom, camera, sensor and fire-alarm markers, cones, sensor/fire coverage, walls + wall drawing tool, hubs, cable lines + trunk lines + cable/trunk drawing tools + vertex editor, floor tabs + active floor management, calibration overlay |
| `src/panels/` | Toolbar, catalog sidebar (Cameras / Sensors / Fire alarm / Control panel tabs), camera, sensor, fire-alarm, hub, cable and shaft properties panels, cable estimate panel, BOM panel (with per-floor filter), view panel (layer visibility toggles), floor tabs UI |
| `src/export/` | PNG (per-floor or all floors) and CSV (whole project) export |
| `src/file-io/`, `src/state/` | Project save/load, zustand stores with multi-floor support, undo/redo with floor auto-switching |

Every `src/` folder except `state/` is split into feature subfolders (`beam`, `bom`, `cable`,
`camera`, `sensor`, `wall`, ... plus `shared` for cross-feature helpers).

Back to the [README](../README.md).
