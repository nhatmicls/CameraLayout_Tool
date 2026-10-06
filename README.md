# Camera Layout Tool

Browser-only floor-plan camera planner. Load a floor-plan image, calibrate the scale, drag
Hikvision / Dahua / Axis camera models onto the plan, see FOV cones shaded by EN 62676-4 DORI
bands, draw cable routes to get a provisional cable-length estimate, and get a priced bill of
materials. Export a PNG (plan + BOM strip) and a BOM CSV,
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
- **Sensors**: the sidebar's Sensors tab holds 11 records across Hikvision, Dahua, Bosch and
  Takex (3 PIR motion, 3 IR beam, 3 vibration / glass-break, 2 thermal), every spec copied
  from the official datasheet or the manufacturer's install manual. Thermal cameras live
  here, not in the camera catalog. Drag a card onto the plan like a camera; sensors are
  numbered S1, S2... and have their own properties panel.
  - PIR: a sector at the datasheet range and angle (a ceiling PIR is a full 360° circle).
    Range and angle can be reduced, never raised above the datasheet.
  - IR beam: a straight line between two draggable ends (transmitter and receiver). An
    Indoor / Outdoor switch picks which datasheet maximum distance applies. The line turns
    dashed with a warning when it is longer than that maximum or an opaque wall crosses it;
    crossing glass only adds a note.
  - Vibration / glass-break: a circle of the datasheet radius.
  - Thermal: a flat sector at the datasheet HFOV, banded by the datasheet's human detection /
    recognition / identification distances - these are not EN 62676-4 DORI. A new thermal
    cone is drawn at 100 m or the datasheet detection distance, whichever is smaller; you can
    raise it to the datasheet figure.

  Limits: coverage shapes are the datasheet's nominal figures - a planning aid, not a
  detection guarantee. Real coverage depends on mounting, lens masks, temperature and
  environment. Mounting height and tilt are not modelled for sensors. A datasheet that prints
  feet only is converted to metres (x 0.3048, rounded to 0.1 m) and marked "converted from
  ft"; no current record needs it.
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
  thickness, so mounting height never lets a camera see over one. Glass never blocks cameras.
  For sensors: opaque walls clip PIR, thermal and vibration / glass-break coverage; glass is
  also treated as blocking PIR and thermal (long-wave IR does not pass ordinary glass) but
  not vibration / glass-break circles; an IR beam is not clipped, it is flagged as blocked
  when an opaque wall crosses it. There are no low
  obstacles and no furniture. Walls are drawn by hand, not detected from the image. A wall
  within 0.3 m of a camera is treated as the wall it is mounted on and ignored for that
  camera - so a camera aimed back through its mounting wall is shown seeing into the next
  room. The same 0.3 m rule applies to sensors and to both ends of a beam.
- **Cables**: a provisional cable-length estimate from routes you draw by hand.
  - Hubs: click "Add hub" and click the plan to place a hub (switch, recorder, alarm panel);
    hubs are numbered H1, H2... and can be dragged. A hub has a mount height (default 1.5 m)
    and is where cables end. Hubs are not a BOM line.
  - Risers and drops: "Add riser" places the point where cables go up to the floor above
    (R1, R2..., up arrow), "Add drop" the point where they go down to the floor below (D1,
    D2..., down arrow). Both work like a hub - cables end on them. A riser's "Rises to" is
    the height above this floor the cable climbs to (it starts at the route height, so set
    it); a drop's "Goes down to" is how far below this floor it ends (it starts at 0, i.e.
    the cable descends the route height). "Length on the other floor" (default 0) is added
    to every cable ending there, for the run from that point to its hub. Each plan is one
    floor: the other floor's own routes are not drawn here.
  - While "Draw cable" is on, camera cones and sensor coverage are hidden so the route is
    drawn on a clear plan; they come back when you leave the tool.
  - Drawing: click "Draw cable", click a camera, a sensor (either end of an IR beam) or a hub
    to start, click to add route points, then click the other kind of end - a hub, riser
    or drop after a device, a device after one of those - to finish. Backspace removes the last point, Esc cancels
    the cable, a second Esc leaves the tool. The cable takes the type chosen in the toolbar.
  - Editing: click a cable to select it, drag a point to move it, double-click the line to
    add a point, double-click a point to remove it. Deleting a camera, sensor or hub also
    removes its cables, in the same undo step.
  - Cable types: name, optional length limit (m) and optional price (VND/m) - a new project
    starts with Cat6 UTP (90 m limit), Power 2-core and Alarm signal, all without a price.
    A type in use, or the last remaining type, cannot be deleted.
  - How the estimate is built, per cable: horizontal route length (drawn route / scale) +
    the vertical run at each end (route height vs the device's and the hub's height) + the
    length on the other floor (riser / drop only) + slack at each end = the run; the run + waste % = what to buy. Per type the metres are summed
    and rounded up to a whole metre. Defaults (the "Allowances" section): waste 15 %, route
    height 3 m, device height 3 m (used for sensors and for cameras with no mounting height),
    slack 0.5 m at the device and 3 m at the hub.
  - Range: every length is shown with a min-max range, e.g. `30.8 m (30.6-31.1 m)`. It is
    the worst case of the scale's click error only: each of the two scale clicks may be off
    by the "scale click error" (default 3 image px), which stretches or shrinks every
    horizontal length by the same factor. A very short reference line gives a warning.
  - Length limit: a cable whose run (without waste) exceeds its type's limit is drawn red
    and dashed and listed as a warning; one that exceeds it only at the top of the range is
    dashed and listed as "may exceed".
  - Limits: the route is 2D with straight segments - no conduit bends, no obstacles. The
    range does not cover image distortion, a perspective photo, or a wrongly typed reference
    length. This is not a voltage-drop or PoE-budget calculation. Sensors have no mounting
    height, so they use the default device height. A cable end follows its camera, sensor or
    hub when the drag is dropped, not while dragging. There are no hub-to-hub links. A cable
    type's colour is its position in the type list. Measure on site before ordering.
- **Bill of materials**: camera rows grouped by model + lens, then sensor rows grouped by
  model, then one cable row per cable type in use, with quantity, labels (C1, C3 / S2, S5 /
  C1-H1), unit price, line total and one estimated grand total. One placed beam counts as one
  transmitter + receiver set. A cable row's quantity is whole metres to buy.
  The CSV and the PNG table have the columns `Type, Brand, Model, Form Factor, Resolution,
  Lens, Quantity, Unit, Labels, Unit Price (VND), Total (VND)`. Breaking change for anything
  that parses the CSV: `Unit` is new, after `Quantity` (`pcs` for cameras and sensors, `m`
  for cables); earlier, `Type` was added first and `Cameras` was renamed `Labels`. For
  sensors `Form Factor` is empty, and `Resolution` / `Lens` are filled for thermal only. A
  cable row has Type `Cable`, the type name in `Model` and the price per metre in `Unit
  Price`. Cable rows need a scale: a CSV exported before the scale is set leaves them out
  and says so.
- **Export**: PNG at image resolution with a legend + BOM strip (downscaled with a notice above
  ~16.7 M pixels), and a BOM CSV. The PNG draws hubs and cables and, when the plan has
  cables, a legend line with the cable types and the provisional total. The PNG needs a
  scale. Project save/load as JSON.

## Prices

Prices are indicative Vietnam street prices in VND, read from a Vietnamese reseller's product
page on the date stored with each record; each catalog card links to its source. Models with
no published Vietnam price show "price on request" and are excluded from the estimated total
(the total says how many cameras or sensors it leaves out). Axis camera prices come from a
cross-border marketplace, not an authorised distributor. Takex beam prices are set prices
(TX+RX pair). Always confirm with your supplier.

Cable prices are the one price you type yourself: VND per metre, per cable type, saved with
the project. Nothing is prefilled. A type with no price shows "price on request" and is left
out of the total, which says how many cable types it leaves out.

A camera catalog record can also carry up to two sales channels - a primary one (a Shopee
shop) and a secondary one (another Vietnamese shop). Its card then shows one row per channel:
that shop's price and a "buy (shopee)" / "buy (hacom)" link. 63 Hikvision camera records
have them. The BOM keeps using one price per model: the secondary shop's where it shows one,
else the Shopee one. Sensor cards work the same way: the 4 priced sensor records carry a
secondary channel (the shop their price was read from); none has a Shopee listing yet.

PTZ models are drawn as one cone at the bearing you set (2.8-12 mm zoom adjustable like any
varifocal lens); the pan sweep is not modelled.

Camera sources and method: [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md).
Sensor sources: [`docs/sensor-catalog-sources.md`](./docs/sensor-catalog-sources.md).

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
| `data/` | Camera and sensor catalog JSON: `data/<brand>/<device-type>/<brand>-<device-type>_<NN>.json`, device type = `camera-<form factor>` or `sensor-<kind>` |
| `src/catalog/` | Zod schemas and loaders for the camera and sensor catalogs |
| `src/domain/` | Pure logic: FOV geometry, DORI distances, mounted-camera floor coverage, sensor coverage (resolver, thermal bands, beam line check, wall-blocking table), wall visibility geometry (occlusion polygon, endpoint snap, crossing detection), cable layout (types, length + range estimate, snap lookup, drawing chain, vertex editing), scale, BOM grouping, CSV, project file schema (no React/Konva imports) |
| `src/canvas/` | Konva stage, pan/zoom, camera and sensor markers, cones, sensor coverage, walls + wall drawing tool, hubs, cable lines + cable drawing tool + vertex editor, calibration overlay |
| `src/panels/` | Toolbar, catalog sidebar (Cameras / Sensors tabs), camera, sensor, hub and cable properties panels, cable estimate panel, BOM panel |
| `src/export/` | PNG and CSV export |
| `src/file-io/`, `src/state/` | Project save/load, zustand stores, undo/redo |

Every `src/` folder except `state/` is split into feature subfolders (`beam`, `bom`, `cable`,
`camera`, `sensor`, `wall`, ... plus `shared` for cross-feature helpers).

## Docs

- [`docs/tech-stack.md`](./docs/tech-stack.md) - approved stack, versions, decisions
- [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md) - datasheet and price provenance for every camera catalog record
- [`docs/sensor-catalog-sources.md`](./docs/sensor-catalog-sources.md) - the same for the sensor catalog
- [`docs/project-changelog.md`](./docs/project-changelog.md) - dated record of features and breaking changes
- [`docs/development-roadmap.md`](./docs/development-roadmap.md) - what is done and what is open

## Status

v1 in progress. Working: image load, calibration, camera + sensor catalogs, placement, DORI
cones, sensor coverage (PIR sectors / beams / thermal), properties, BOM with prices, mounting
height + tilt floor coverage, walls with camera cone occlusion and sensor wall blocking, hubs
and cable routes with a cable-length estimate, save/load, PNG + CSV export (verified in
Chromium). Project files are saved as schema version 5: files from earlier versions (1-4)
still open, but a file saved by this version needs this version or newer. Known limit: on a very dense plan (about 100 sensors and 300 walls) moving
a wall or a sensor can take a few tenths of a second to redraw. Not done yet: Playwright
end-to-end suite, Firefox/Safari export checks, full documentation set.
