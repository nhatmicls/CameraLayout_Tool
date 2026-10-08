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
- **Sensors**: the sidebar's Sensors tab holds 26 records across Hikvision, Dahua, Bosch and
  Takex (17 PIR motion, 3 IR beam, 4 vibration / glass-break, 2 thermal), every spec copied
  from the official datasheet or the manufacturer's install manual. The tab also lists
  two marker-only kinds from the alarm catalog - magnetic contacts (6) and an environment
  (temperature) detector (1): they are placed as a marker with no coverage shape and are
  numbered F1, F2... like the other alarm devices. Thermal cameras live here, not in the
  camera catalog. Drag a card onto the plan like a camera; sensors are numbered S1, S2... and
  have their own properties panel. Filters: Brand, Type and "Works with" drop-downs (see
  Control panel tab).
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
  - Magnetic contact / environment detector: markers only, no coverage shape, labelled F1,
    F2... with the other alarm devices.

  Limits: coverage shapes are the datasheet's nominal figures - a planning aid, not a
  detection guarantee. Real coverage depends on mounting, lens masks, temperature and
  environment. Mounting height and tilt are not modelled for sensors. A datasheet that prints
  feet only is converted to metres (x 0.3048, rounded to 0.1 m) and marked "converted from
  ft"; no current record needs it.
- **Fire alarm / alarm panels**: the sidebar's Fire alarm tab holds Hikvision detectors and
  call points: 4 smoke (including 1 standalone), 2 heat, 2 CO, 6 manual call points / panic
  buttons, 4 sounders (18 records); specs copied from the official Hikvision datasheet or the
  AX PRO user manual. The AX lines are intrusion alarm systems (the AX PRO manual lists
  detectors as peripherals), not certified fire-alarm control panels; emergency buttons are
  portable panic buttons, not fire call points. Drag a card onto the plan (scale required);
  devices are numbered F1, F2... Placement: select, drag, delete, undo/redo.
  - **Coverage modes** (toolbar control, shown when the Fire alarm tab is active or a device
    is placed): "Datasheet" draws markers only (no detector prints a protection area). "TCVN
    5738" mode (Vietnam standard, clause 6.13 Bảng 1 for smoke up to 12 m, clause 6.15.1 Bảng 2
    for heat up to 9 m) draws, for smoke and heat detectors, a dashed circle of equal area to
    the standard's "average protected area per detector" (`r = sqrt(A / pi)`). The circle
    approximates an area + spacing-grid rule, so circles on a compliant grid leave gaps at the
    corners. Ceiling beams, projections, narrow rooms and the condition "not larger than the
    detector's own documents" are not modelled. No circle is drawn for CO detectors, for a
    ceiling height above the table's last band, or when no scale is set. Circles are clipped by opaque and
    glass walls (same 0.3 m mounting-wall rule); hidden in cable mode. Limits: the circles
    are planning aids, not a fire-safety design or a compliance check. The shipped detectors
    are intrusion-system or standalone smoke alarms, not certified to TCVN 5738; verify
    against the official standard text. The table numbers were read from the full-text
    reprint on dulieuphapluat.vn; the toolbar control and the properties panel link to that
    page so you can open the document the circles are based on.
  - **Compatibility** is controller-centric: it is stored only on control panel / hub records
    and shown only on their cards (Control panel tab) as a count with a "View list" button;
    the popup lists each device with its official source link and firmware note. Every entry
    is a row of one of Hikvision's two official model-by-model lists (AXPRO Series
    Compatibility List, AX HYBRID PRO Device Compatibility List). Two readings to know about:
    a "—" cell on the AX HYBRID PRO list is taken as "compatible with every firmware
    version" (the page prints no legend), and the AXPRO list writes rows as "-WE/WB", so each
    variant is attached to the hub of the same frequency (868 MHz DS-PWA96-M-WE with `-WE`,
    433 MHz DS-PWA96-M2H-WB with `-WB`). Wireless devices on an AX Hybrid PRO panel need the
    bus wireless receiver DS-PM1-RT-HWB (in the Control panel tab); the app does not check
    that one is placed.
  - Warnings: a placed alarm device (any tab's F-numbered device) is flagged when it is "not
    listed" for any placed panel / hub, with one combined line when no panel / hub is placed.
    "Not listed" means no official statement was found, not proof of incompatibility.
    Standalone devices are never flagged, and placed coverage sensors (S-numbered) are never
    flagged - for them compatibility is a catalog filter only. Capacity is shown as printed on
    the datasheet (display only; no assignment or capacity checks).
- **Control panel tab**: the alarm system's own hardware - 3 AX Hybrid PRO control panels and 2 AX PRO hubs (868 MHz and 433 MHz), plus their modules: expanders / the bus wireless
  receiver, keypads, a keyfob, relay modules, a repeater and communicator modules (tag
  reader, power supply and accessory kinds exist but have no records yet). All are placed as
  markers.
  - **Filters** (Sensors, Fire alarm and Control panel tabs): Brand and Type drop-downs, and
    one shared "Works with" drop-down listing every control panel / hub in two groups,
    "Placed in this project" and "Not placed". Choosing one shows only the devices that
    panel's official compatibility entries name (in the Control panel tab the chosen panel
    stays visible); the choice carries across the three tabs. A hidden device is "not
    listed", not proven incompatible - with a panel chosen, the Sensors tab therefore hides
    every sensor that panel's list does not name, including all other brands.
- **Alarm-device prices**: 11 of the 42 alarm-catalog records have a Vietnamese price
  (vuhoangtelecom.vn); 23 more link to a contact-for-price page on mastery.vn; the rest are
  "price on request". No Shopee listing could be verified.
- **Floors**: a project holds 1 to 20 floors, shown as tabs under the toolbar; tab 1 is the
  lowest floor. Each floor has its own plan image, scale, cameras, sensors, walls, hubs, cables
  and alarm devices, numbered per floor (C1, S1, F1, H1... start again on every floor). Cable
  types, cable allowances, the fire-detector coverage mode and shafts belong to the whole project.
  - Tabs: click to switch (the view refits each time), "+ Floor" adds one, double-click a name
    (or F2 / Enter) to rename, and the active tab has move left / move right, delete and a
    "floor-to-floor height" input (default 3.5 m, 0.5-30 m; not shown on the top floor). A new
    floor is empty until you load its plan. Switching floors is not an undo step; undo / redo
    takes you to the floor it changed. Deleting a floor can be undone.
  - Replacing a floor's plan image clears that floor only and is one undo step.
  - Linking a riser to a drop: select a riser or drop and click "Create paired point" to place
    the matching point on the floor above / below and link the two (or pick an existing point in
    "Linked to"). Only adjacent floors can be linked, one partner each. Until a route is drawn
    the typed values still apply ("Rises to" / "Goes down to" and "Length on the other floor").
  - Route to a hub: on the floor where the cables arrive, select the linked point, click "Draw
    route to hub", click the route points and finish on a hub (Backspace removes the last point,
    Esc cancels). The route is a dotted line; with its point selected you can drag a route point,
    double-click the line to add one, double-click a point to remove one. Once the route exists,
    every cable ending on the partner point is measured as: its own route + the floor-to-floor
    height + the route (at that floor's scale) + the drop at the hub. The typed height and length
    are then ignored - expect the length to jump when you draw the route.
  - Shafts: a vertical tube through several floors. Click "Shaft", click the plan, name it and
    choose the floor range: an opening (T1, T2... - the same label on every floor) is placed on
    each of those floors that has a plan, at the same position; drag each one to where the tube
    really is. Cables end on an opening like on a hub. An opening with a route to a hub is an
    exit, and a shaft can have several. With one exit every cable uses it; with several, each
    cable must be told which (the "Exit" select in the cable's properties, or "assign" in the
    shaft panel) and its label shows it, e.g. `C1-T1>F3`. A cable with no exit chosen has no
    length and is left out of the totals - the shaft panel shows cables in, out per exit and not
    chosen, and the BOM, the CSV message and the PNG say how many are missing. The vertical run is
    the sum of the floor heights between the cable's floor and the exit floor. A shaft with no
    exit route yet uses the typed "Length beyond this opening" and adds no vertical run. A route
    cannot end on a shaft opening.
  - A cable that crosses floors is counted on the floor of its camera or sensor. Each floor is
    measured with its own scale; if a floor on the way has no scale the cable has no length and
    is reported, never guessed.
  - Limits: plans of different floors are not aligned to each other; one route per riser / drop;
    floor heights are typed, not measured. Plan images are stored in the project file, which is
    limited to 80 MB: adding an image that would pass the limit is refused. A replaced or deleted
    plan image stays in memory while undo can still bring it back.
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
  when an opaque wall crosses it. For fire-alarm detectors: fire detector coverage circles (in
  TCVN 5738 mode only) are clipped by both opaque and glass walls. There are no low
  obstacles and no furniture. Walls are drawn by hand, not detected from the image. A wall
  within 0.3 m of a camera is treated as the wall it is mounted on and ignored for that
  camera - so a camera aimed back through its mounting wall is shown seeing into the next
  room. The same 0.3 m rule applies to sensors, fire-alarm detectors, and to both ends of a beam.
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
    to every cable ending there, for the run from that point to its hub. In a project
    with several floors a riser can be linked to the drop on the floor above and the run
    measured from a drawn route instead of typed, and a shaft can carry cables through
    several floors - see Floors.
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
    A type in use on any floor, or the last remaining type, cannot be deleted.
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
- **View**: collapsed section at the top of the right panel with toggles to hide / show layer groups on the active floor. Includes 16 toggles: camera markers, camera FOV cones, each camera form factor (bullet, dome, turret, PTZ, fisheye), sensor markers (including IR beam line + ends), sensor coverage shapes (including thermal cones), each sensor kind (PIR, IR beam, vibration, thermal), hubs / risers / drops, cable routes (including trunk routes to hubs on other floors), and walls. Every toggle option is always listed with a live item count for the active floor; a "N hidden" badge shows when any are off; "Show all" resets all to visible. The Cameras, Sensors and Cabling headings are parent checkboxes: unticking one unticks every row under it, ticking it turns them all on, and it shows a dash when only some rows are on. The per-type rows sit under their own parent ("Types" for cameras, "Kinds" for sensors) that works the same way; a type that is off hides both the marker and the cone / coverage of those items. Hidden walls still block camera cones and sensor coverage. A drawing tool (wall, hub, cable, trunk) forces its own layers visible while the tool is active and restores the previous state when leaving. Labels never renumber when items are hidden, and a cable is still drawn to a hidden camera, sensor or hub. Hiding the type of the selected item deselects it; dropping a catalog card of a hidden type turns that type back on. The PNG export (both "Export PNG" and "Export all floors") draws the on-screen state for that floor: if anything is hidden, the strip prints a wrapped "Shown: ... / Hidden: ..." note under the legend; legend lines, BOM strip, BOM panel, CSV and cable estimate always cover everything. Fire-alarm devices and their coverage are always drawn (no toggle). View state is not saved in the project file, not undoable, is kept when you switch floors, and is reset to all visible when a project is opened or a new plan image is loaded.
- **Bill of materials**: one list for the whole project: camera rows grouped by model + lens,
  then sensor rows grouped by model, then fire-alarm rows grouped by kind (unit `pcs`), then one
  cable row per cable type in use, with quantity, labels, unit price, line total and one
  estimated grand total. One placed beam counts as one transmitter + receiver set. A cable row's
  quantity is whole metres to buy.
  With more than one floor the same model on several floors is one row, and every label carries
  its floor: `F2-C1` is camera C1 on floor 2, `F2-C1-H1` its cable, `F2-F1` alarm device F1 on
  floor 2 (the first `F2` is the floor). An "All floors" drop-down above the list can show one floor's rows
  without the prefix. A one-floor project has no prefix and no filter. Cable metres are summed
  over all floors and rounded up once per type; a single floor's view rounds that floor alone, so
  per-floor figures can add up to a few metres more than the project total (at most one metre
  per extra floor and type). Cables that could not be measured (no exit chosen in a shaft, or a
  floor on the way without a scale) are left out of the metres and the list says how many.
  The PNG table has 11 columns: `Type, Brand, Model, Form Factor, Resolution, Lens,
  Quantity, Unit, Labels, Unit Price (VND), Total (VND)`. The CSV has the same 11 columns
  plus a 12th trailing column `Notes` (breaking change for strict CSV parsers), filled only on
  fire-alarm rows with a compatibility warning if the device is "not listed" for a placed
  panel/hub, or "No panel/hub placed". A panel / hub placed on any floor counts as placed. For
  sensors `Form Factor` is empty, `Resolution` / `Lens` filled for thermal only. For fire-alarm
  devices `Type` is the device kind (e.g. "Smoke detector") and `Form Factor`, `Resolution` and
  `Lens` are empty. A cable row has Type `Cable`, the type name in `Model` and the price per
  metre in `Unit Price`. Cable rows need a scale: a floor without one adds no metres and the
  export says which floors.
- **Export**: PNG at image resolution with a legend + BOM strip (downscaled with a notice above
  ~16.7 M pixels), and a BOM CSV. "Export PNG" exports the floor you are looking at and needs
  its scale; the strip lists that floor's rows, matching the labels on the picture. The PNG
  draws hubs, cables and routes and, when the plan has cables, a legend line with the cable
  types and the provisional total. With several floors, "Export all floors" downloads one PNG
  per floor, one after another (the browser may ask once to allow several downloads); floors
  without a plan or a scale are skipped and named. Each strip then also says which floor it is,
  names the shafts on it and notes that cable metres are rounded per floor, and the files are
  named `F2-<floor name>-<image name>-camera-layout.png`. The CSV always covers the whole
  project. Project save/load as JSON.

## Prices

Prices are indicative Vietnam street prices in VND, read from a Vietnamese reseller's product
page on the date stored with each record; each catalog card links to its source. Models with
no published Vietnam price show "price on request" and are excluded from the estimated total
(the total says how many cameras, sensors or fire devices it leaves out). Axis camera prices
come from a cross-border marketplace, not an authorised distributor. Takex beam prices are set
prices (TX+RX pair). Fire-alarm devices are mostly "price on request" (11 of 42 have a Vietnamese price (vuhoangtelecom.vn); 23 more link to a contact-for-price page on mastery.vn; no Shopee listing could be verified).
Sensor cards: the 8 priced records carry a secondary channel (the shop their price was read
from); none has a Shopee listing. Always confirm with your supplier.

Cable prices are the one price you type yourself: VND per metre, per cable type, saved with
the project. Nothing is prefilled. A type with no price shows "price on request" and is left
out of the total, which says how many cable types it leaves out.

A camera catalog record can also carry up to two sales channels - a primary one (a Shopee
shop) and a secondary one (another Vietnamese shop). Its card then shows one row per channel:
that shop's price and a "buy (shopee)" / "buy (hacom)" link. 63 Hikvision camera records
have them. The BOM keeps using one price per model: the secondary shop's where it shows one,
else the Shopee one.

PTZ models are drawn as one cone at the bearing you set (2.8-12 mm zoom adjustable like any
varifocal lens); the pan sweep is not modelled.

Camera sources and method: [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md).
Sensor sources: [`docs/sensor-catalog-sources.md`](./docs/sensor-catalog-sources.md).
Fire-alarm sources: [`docs/fire-alarm-catalog-sources.md`](./docs/fire-alarm-catalog-sources.md).

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
| `data/` | Catalog JSON: `data/<brand>/<device-type>/<brand>-<device-type>_<NN>.json`; device type = `camera-<form factor>`, `sensor-<kind>`, or `fire-alarm-<kind>` (control-panel, wireless-hub, expander-module, keypad, keyfob, tag-reader, relay-module, repeater, communicator, power-supply, accessory, smoke-detector, heat-detector, co-detector, manual-call-point, sounder, magnetic-contact, environment-detector) |
| `src/catalog/` | Zod schemas and loaders for the camera, sensor and fire-alarm catalogs |
| `src/domain/` | Pure logic: FOV geometry, DORI distances, mounted-camera floor coverage, sensor coverage (resolver, thermal bands, beam line check, wall-blocking table), fire-alarm coverage (resolver, TCVN 5738 table, wall-blocking table), wall visibility geometry (occlusion polygon, endpoint snap, crossing detection), cable layout (types, length + range estimate, snap lookup, drawing chain, vertex editing, cross-floor link and shaft models), compatibility checker (fire devices), floor list editing (add/delete/rename/reorder), scale, BOM grouping (merged across floors), CSV, project file schema, view config (toggles, hidden-id sets, tool-layer forcing) (no React/Konva imports) |
| `src/canvas/` | Konva stage, pan/zoom, camera, sensor and fire-alarm markers, cones, sensor/fire coverage, walls + wall drawing tool, hubs, cable lines + trunk lines + cable/trunk drawing tools + vertex editor, floor tabs + active floor management, calibration overlay |
| `src/panels/` | Toolbar, catalog sidebar (Cameras / Sensors / Fire alarm / Control panel tabs), camera, sensor, fire-alarm, hub, cable and shaft properties panels, cable estimate panel, BOM panel (with per-floor filter), view panel (layer visibility toggles), floor tabs UI |
| `src/export/` | PNG (per-floor or all floors) and CSV (whole project) export |
| `src/file-io/`, `src/state/` | Project save/load, zustand stores with multi-floor support, undo/redo with floor auto-switching |

Every `src/` folder except `state/` is split into feature subfolders (`beam`, `bom`, `cable`,
`camera`, `sensor`, `wall`, ... plus `shared` for cross-feature helpers).

## Docs

- [`docs/tech-stack.md`](./docs/tech-stack.md) - approved stack, versions, decisions
- [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md) - datasheet and price provenance for every camera catalog record
- [`docs/sensor-catalog-sources.md`](./docs/sensor-catalog-sources.md) - the same for the sensor catalog
- [`docs/fire-alarm-catalog-sources.md`](./docs/fire-alarm-catalog-sources.md) - the same for the fire-alarm catalog
- [`docs/project-changelog.md`](./docs/project-changelog.md) - dated record of features and breaking changes
- [`docs/development-roadmap.md`](./docs/development-roadmap.md) - what is done and what is open

## Status

v1 in progress. Working: image load, calibration, floors (tabs, per-floor plan / scale / height),
camera + sensor + fire-alarm catalogs, placement, DORI cones, sensor coverage (PIR sectors /
beams / thermal), fire-alarm marker and coverage (datasheet mode or TCVN 5738 circles with
ceiling height), compatibility warnings, properties, BOM with prices (one list for all floors),
mounting height + tilt floor coverage, walls with camera cone occlusion and sensor/fire-alarm
wall blocking, hubs and cable routes with a cable-length estimate, riser / drop links with a
drawn route, shafts with several exits, layer visibility toggles, save/load, PNG (per floor) +
CSV export (verified in Chromium). Project files are saved as schema version 7: files from
earlier versions (1-6) still open as a one-floor project, but a file saved by this version
needs this version or newer. Known limit: on a very dense plan (about 100 sensors and 300
walls) moving a wall or a sensor can take a few tenths of a second to redraw. End-to-end
tests are smoke tests in Chromium against the dev server. Not done yet: cabling fire devices,
end-to-end tests against the production build, Firefox/Safari export checks.
