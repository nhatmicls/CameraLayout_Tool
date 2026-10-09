# Security Layout Planner

Browser-only floor-plan planner for security systems. Load a floor-plan image, calibrate the
scale, drag cameras, intrusion sensors and alarm devices onto the plan, see their coverage,
draw cable routes for a provisional cable-length estimate, and get a priced bill of materials.
Export a PNG (plan + BOM strip) and a BOM CSV, save/load the project as JSON. Nothing leaves
the browser: no backend, no accounts, no network calls once the page has loaded.

Formerly "Camera Layout Tool". Project files keep the internal id `camera-layout-tool`, so
files saved before the rename still open.

## Quick start

```bash
npm ci
npm run dev
```

Needs Node 20.19.x (or >=22.12) and npm 10.x. Scripts, Windows notes and the folder layout:
[`docs/local-setup.md`](./docs/local-setup.md).

## Features

| Feature | Summary | Guide |
| --- | --- | --- |
| Floor plan + scale | Load a PNG/JPEG, calibrate with a reference line of known length | [plan, cameras, walls](./docs/user-guide-plan-cameras-and-walls.md) |
| Cameras | 106 records (Hikvision, Dahua, Axis), specs from the official datasheets; FOV cones banded by EN 62676-4 DORI; optional mounting height + tilt floor coverage | [plan, cameras, walls](./docs/user-guide-plan-cameras-and-walls.md) |
| Walls | Opaque or glass segments drawn by hand; cones and sensor coverage are clipped live | [plan, cameras, walls](./docs/user-guide-plan-cameras-and-walls.md) |
| View | 16 toggles to hide / show layer groups on the active floor; never saved | [plan, cameras, walls](./docs/user-guide-plan-cameras-and-walls.md) |
| Sensors | 31 records (Hikvision, Dahua, Bosch, Takex): PIR, IR beam, vibration / glass-break, thermal | [sensors and alarm devices](./docs/user-guide-sensors-and-alarm-devices.md) |
| Fire alarm | 25 detectors, call points and sounders (Hikvision, 1 AoLin); datasheet or TCVN 5738 coverage circles | [sensors and alarm devices](./docs/user-guide-sensors-and-alarm-devices.md) |
| Control panels | AX Hybrid PRO panels, AX PRO hubs and their modules; "works with" filter and "not listed" warnings from Hikvision's official compatibility lists (plus owner-declared 4-wire devices) | [sensors and alarm devices](./docs/user-guide-sensors-and-alarm-devices.md) |
| Floors | 1 to 20 floors as tabs, each with its own plan, scale and devices | [floors and cables](./docs/user-guide-floors-and-cables.md) |
| Cables | Hubs, hand-drawn routes, risers / drops and shafts across floors; length estimate with a range and length-limit warnings | [floors and cables](./docs/user-guide-floors-and-cables.md) |
| Bill of materials | One priced list for the whole project, or one floor | [BOM, export, prices](./docs/user-guide-bom-export-and-prices.md) |
| Export | PNG per floor (plan + legend + BOM strip), CSV for the whole project, project JSON | [BOM, export, prices](./docs/user-guide-bom-export-and-prices.md) |
| Prices | Indicative Vietnam street prices in VND with a source link per record; cable prices are typed by you | [BOM, export, prices](./docs/user-guide-bom-export-and-prices.md) |

Coverage shapes, cable lengths and prices are planning aids, not a detection guarantee, a
fire-safety design or a quote. Each guide lists its limits; measure on site and confirm with
your supplier before ordering.

## Docs

- [`docs/local-setup.md`](./docs/local-setup.md) - prerequisites, install, scripts, project layout
- [`docs/user-guide-plan-cameras-and-walls.md`](./docs/user-guide-plan-cameras-and-walls.md) - plan + scale, camera catalog, placement, DORI, mounting, walls, view
- [`docs/user-guide-sensors-and-alarm-devices.md`](./docs/user-guide-sensors-and-alarm-devices.md) - sensors, fire alarm, control panels, compatibility
- [`docs/user-guide-floors-and-cables.md`](./docs/user-guide-floors-and-cables.md) - floors, cables, risers / drops, shafts
- [`docs/user-guide-bom-export-and-prices.md`](./docs/user-guide-bom-export-and-prices.md) - bill of materials, PNG / CSV export, prices
- [`docs/tech-stack.md`](./docs/tech-stack.md) - approved stack, versions, decisions
- [`docs/camera-catalog-sources.md`](./docs/camera-catalog-sources.md) - datasheet and price provenance for every camera catalog record
- [`docs/sensor-catalog-sources.md`](./docs/sensor-catalog-sources.md) - the same for the sensor catalog
- [`docs/fire-alarm-catalog-sources.md`](./docs/fire-alarm-catalog-sources.md) - the same for the fire-alarm catalog
- [`docs/project-changelog.md`](./docs/project-changelog.md) - dated record of features and breaking changes
- [`docs/development-roadmap.md`](./docs/development-roadmap.md) - what is done and what is open

## Status

v1 in progress; every feature in the table above works and is verified in Chromium.

- Project files are saved as schema version 8. Version 7 files open unchanged and files
  from versions 1-6 still open as a one-floor project, but a file saved by this version needs this version or newer.
- Known limit: on a very dense plan (about 100 sensors and 300 walls) moving a wall or a
  sensor can take a few tenths of a second to redraw.
- End-to-end tests are smoke tests in Chromium against the dev server.
- Not done yet: end-to-end tests against the production build,
  Firefox/Safari export checks.
