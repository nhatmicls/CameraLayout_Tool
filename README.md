# Camera Layout Tool

Browser-only floor-plan camera planner. Load a floor-plan image, calibrate the scale, drag
Hikvision / Dahua / Axis camera models onto the plan, see FOV cones shaded by EN 62676-4 DORI
bands, and get a priced bill of materials. Export a PNG (plan + BOM strip) and a BOM CSV,
save/load the project as JSON. Nothing leaves the browser: no backend, no accounts, no network
calls once the page has loaded.

## Features

- **Floor plan + scale**: load a PNG/JPEG, draw a reference line of known length to calibrate.
- **Camera catalog**: 51 records across Hikvision, Dahua and Axis (one per lens option), every
  optical spec transcribed from the official datasheet. Each card also shows the datasheet's
  IP / IK rating, built-in mic or speaker, and the target classes its on-device analytics
  print (human / vehicle / face / license plate); the properties panel adds audio ports. "Not
  listed"
  means the datasheet does not print it, not that the camera lacks it. Filter by brand, form
  factor, "only models with a listed price", outdoor rating (IP65+), built-in mic, and
  human / vehicle detection.
- **Placement**: drag from the catalog, move, rotate with the handle, adjust range and (for
  varifocal lenses) HFOV in the properties panel. Undo/redo.
- **DORI coverage**: each cone is banded Identify / Recognize / Observe / Detect per EN 62676-4.
- **Mounting height + tilt** (optional, per camera): click "Set mounting height + tilt" in the
  properties panel and enter the lens height and the downward tilt. The cone then shows floor
  coverage: it starts at the blind spot under the camera and ends at the far edge of the view
  (or at the range, whichever is nearer). The panel lists blind spot, far edge and where each
  DORI threshold lands on the floor, next to the datasheet's illumination range, and warns
  when the far edge is beyond that range (it never clips to it). Vertical FOV is the datasheet
  value where the datasheet prints one, otherwise computed from HFOV and the sensor aspect
  ratio and labelled as computed. Cameras without a mounting height keep the flat cone.
  Approximations: DORI floor distances use the slant distance from the lens
  (`sqrt(d² - h²)`), blind spot and far edge are centre-line values drawn as arcs (the true
  footprint is a trapezoid), and tilt is ignored for fisheye lenses (HFOV >= 180°).
- **Bill of materials**: grouped by model + lens, with quantity, camera numbers, unit price,
  line total and an estimated grand total.
- **Export**: PNG at image resolution with a legend + BOM strip (downscaled with a notice above
  ~16.7 M pixels), and a BOM CSV. Project save/load as JSON.

## Prices

Prices are indicative Vietnam street prices in VND, read from a Vietnamese reseller's product
page on the date stored with each record; each catalog card links to its source. Models with
no published Vietnam price show "price on request" and are excluded from the estimated total
(the total says how many cameras it leaves out). Axis prices come from a cross-border
marketplace, not an authorised distributor. Always confirm with your supplier.

Sources and method: [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md).

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
| `npm run test:e2e` | Run end-to-end tests (Playwright, builds + previews first) - no specs written yet |

## Project layout

| Path | Contents |
|---|---|
| `src/catalog/` | Zod schema, loader, and the three brand JSON data files |
| `src/domain/` | Pure logic: FOV geometry, DORI distances, mounted-camera floor coverage, scale, BOM grouping, CSV, project file schema (no React/Konva imports) |
| `src/canvas/` | Konva stage, pan/zoom, camera markers, cones, calibration overlay |
| `src/panels/` | Toolbar, catalog sidebar, properties panel, BOM panel |
| `src/export/` | PNG and CSV export |
| `src/file-io/`, `src/state/` | Project save/load, zustand stores, undo/redo |

## Docs

- [`docs/tech-stack.md`](./docs/tech-stack.md) - approved stack, versions, decisions
- [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md) - datasheet and price provenance for every catalog record

## Status

v1 in progress. Working: image load, calibration, catalog, placement, DORI cones, properties,
BOM with prices, mounting height + tilt floor coverage, save/load, PNG + CSV export (verified
in Chromium). Project files are saved as schema version 2: files from earlier versions still
open, but a file saved by this version needs this version or newer. Not done yet: Playwright
end-to-end suite, Firefox/Safari export checks, full documentation set.
