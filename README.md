# Camera Layout Tool

Browser-only floor-plan camera planner. Load a floor-plan image, calibrate the scale, drag
Hikvision / Dahua / Axis camera models onto the plan, see FOV cones shaded by EN 62676-4 DORI
bands, and get a priced bill of materials. Export a PNG (plan + BOM strip) and a BOM CSV,
save/load the project as JSON. Nothing leaves the browser: no backend, no accounts, no network
calls once the page has loaded.

## Features

- **Floor plan + scale**: load a PNG/JPEG, draw a reference line of known length to calibrate.
- **Camera catalog**: 106 records across Hikvision, Dahua and Axis (one per lens option), every
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
- **Walls**: click "Draw walls" and click points on the plan to draw wall segments, opaque or
  glass; leave gaps for doors. Every camera's cone is clipped live to what the camera can see
  past the opaque walls, also while you drag it. Walls can be selected, switched between
  opaque and glass, deleted and undone, and are saved with the project and drawn in the PNG.
  Outside drawing mode every wall end shows a dot you can drag to reshape the wall: walls
  joined at that point move together, the dot snaps onto other wall ends, and cones update
  when you drop it.
  Drawing: points snap to existing wall endpoints (endpoint to endpoint only - no angle or grid
  snap); double-click or Esc ends a chain; drag to pan while drawing. Walls are expected to
  meet at endpoints - a wall that crosses another is kept but flagged with a warning, also
  when you open a file that contains crossings.
  Limits: the model is 2D only. An opaque wall is treated as infinitely tall and with no
  thickness, so mounting height never lets a camera see over one. Glass never blocks. There
  are no low obstacles and no furniture. Walls are drawn by hand, not detected from the image.
  A wall within 0.3 m of a camera is treated as the wall it is mounted on and ignored for that
  camera - so a camera aimed back through its mounting wall is shown seeing into the next room.
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

A catalog record can also carry up to two sales channels - a primary one (a Shopee shop) and a
secondary one (another Vietnamese shop). Its card then shows one row per channel: that shop's
price and a "buy (shopee)" / "buy (hacom)" link. 63 Hikvision records have them. The BOM
keeps using one price per model: the secondary shop's where it shows one, else the Shopee one.

PTZ models are drawn as one cone at the bearing you set (2.8-12 mm zoom adjustable like any
varifocal lens); the pan sweep is not modelled.

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
| `src/domain/` | Pure logic: FOV geometry, DORI distances, mounted-camera floor coverage, wall visibility geometry (occlusion polygon, endpoint snap, crossing detection), scale, BOM grouping, CSV, project file schema (no React/Konva imports) |
| `src/canvas/` | Konva stage, pan/zoom, camera markers, cones, walls + wall drawing tool, calibration overlay |
| `src/panels/` | Toolbar, catalog sidebar, properties panel, BOM panel |
| `src/export/` | PNG and CSV export |
| `src/file-io/`, `src/state/` | Project save/load, zustand stores, undo/redo |

## Docs

- [`docs/tech-stack.md`](./docs/tech-stack.md) - approved stack, versions, decisions
- [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md) - datasheet and price provenance for every catalog record

## Status

v1 in progress. Working: image load, calibration, catalog, placement, DORI cones, properties,
BOM with prices, mounting height + tilt floor coverage, walls with cone occlusion, save/load,
PNG + CSV export (verified in Chromium). Project files are saved as schema version 3: files
from earlier versions still open, but a file saved by this version needs this version or newer. Not done yet: Playwright
end-to-end suite, Firefox/Safari export checks, full documentation set.
