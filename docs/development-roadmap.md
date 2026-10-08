# Development Roadmap

## Done

- Floor-plan camera planner v1 foundation: image load, scale calibration, camera placement and DORI coverage, BOM, PNG + CSV export, save/load.
- Hikvision catalog expansion: IP/IK rating, audio, on-device analytics tags, per-shop prices and purchase links.
- Sensors: 11 records (PIR, IR beam, vibration, thermal) with official specs; coverage shapes, wall blocking rules, thermal banding.
- Walls: opaque and glass segments with camera cone occlusion and sensor wall blocking; live redraw, endpoint snap, undo/redo.
- Camera mounting + floor coverage: optional per-camera height and tilt with blind spot, far edge and DORI floor distances on the panel.
- Cables: hand-drawn routes from devices to hubs; cable types with optional length limit and user-entered VND/m prices; provisional length estimate (route + vertical runs + slack + waste %) with scale-click-error range; over-length warnings; vertex editing; BOM rows; PNG legend; project schema v5.
- Fire alarm / alarm panels: 62 records (61 Hikvision, 1 AoLin) (AX Hybrid PRO / AX PRO panels, hubs, 9 accessory kinds, detectors, call points, sounders); placement with F labels; coverage modes (datasheet or TCVN 5738:2021 circles with ceiling height); compatibility warnings (controller records only, "not listed" = no official source, frequency-paired 433/868 MHz); filter by brand, kind, and "works with" controller (shared with Sensors and Control panel tabs); BOM rows; CSV `Notes` column (breaking change); project schema v6.
- Fire alarm catalog expansion (AX HYBRID PRO): 28 additional Hikvision records (magnetic contacts 5, manual call points 6, keypads 3, sounders 4, relay modules 2, repeaters 1, communicators 3, environment detectors 1, keyfobs 1, tag readers 0, power supplies 0, accessories 0 - only models sold in Vietnam with official datasheets); Control panel sidebar tab (2 control panels + 2 wireless hubs + 9 accessory kinds); sensor catalog +12 records (10 PIR, 1 glass-break, 1 PIR-glass-break combo).
- View: 16 toggles for layer visibility (camera markers, FOV cones, per-form-factor, sensor markers, coverage, per-sensor-kind, hubs, cables, walls); collapsible panel with live counts and "N hidden" badge; PNG export follows on-screen config with view-filter note; fire-alarm devices always visible; reset on load; UI-only, not saved. Sidebar filter state (brand, kind, "works with" controller - shared across Sensors/Fire alarm/Control panel tabs).
- Multi-floor projects: 1-20 floors as tabs, each with its own plan, scale, items and floor-to-floor height; riser / drop links with a drawn route; shafts with several exits and a per-cable exit choice; cross-floor cable estimate (each floor at its own scale); one project BOM and CSV with floor-prefixed labels; PNG per floor or for all floors; project file schema v7 (v1-6 files open as one floor); first Playwright smoke tests.

## Open

- **Several routes per riser / drop point**: a linked point carries one route to one hub; use a second pair or a shaft for cables that end elsewhere.
- **Multi-select exit assignment**: select several cables and give them one shaft exit (today: one cable at a time, or all unassigned cables of the current floor at once).
- **Per-floor viewport memory**: remember zoom and pan position per floor across switches (currently: refit on every switch).
- **Drag-and-drop floor tab reorder**: visual drag to reorder floors in the tab bar (currently: move-left/move-right buttons).
- **Firefox/Safari export checks**: verify PNG and CSV export across browsers (Playwright e2e runs on Chromium + dev server only).
- **Production-build e2e verification**: verify e2e test suite against production build, not dev server.
- **Shopee links for fire-alarm devices**: source Shopee shop listings where available (none found in Oct 2026 AX HYBRID PRO expansion).
- **Six datasheet-less AX HYBRID PRO models**: DS-PDPG12P-EG2, DS-PDSK-P, and four others sold in Vietnam but with no downloadable official datasheet - add when/if datasheets are published.
- **868 MHz variants (`-WE`) sold in Vietnam**: currently the `-WE` AX PRO peripherals (868 MHz) are not sold in Vietnam - if/when they become available, add them.
- **View toggles for fire-alarm devices**: add toggles to hide / show fire-alarm device markers and coverage circles (currently always visible).
- **Cabling fire-alarm devices**: extend cable routes to include fire-alarm devices as endpoints (currently camera/sensor only).
- **Dedicated fire-alarm panels**: Hikvision HF-C series (HF-C108, etc.) once official datasheets are available; wireless and wired detectors for them.
- **More AX PRO peripherals**: additional detector models (DS-PDSMK-E-WE, DS-PS1-I-WE, DS-PS1-EV-WE) once datasheets obtained.
- **Fire-alarm prices**: Vietnamese shop prices for remaining records as they become available.
- **Hub-to-hub uplinks**: cables from hub to hub for daisy-chaining recorders or network switches.
- **Live cable follow during drag**: cable route updates in real time while dragging a device, not only when dropped.
- **Reel/box rounding**: round cable metres per type to reel or box multiples (e.g. 50 m reels, 1000 m boxes).
- **Per-cable device-height override**: override the default 3 m device height for individual cables (e.g. a camera at exactly 2.8 m).
- **Hub as a BOM line**: show hub count and model in the BOM (currently omitted, hubs are not priced).
- **CSV min/max metre columns**: export per-cable min/max range as separate columns (currently only the summary range is shown per type).
- **Full documentation set**: codebase overview, architecture, code standards, API guides, troubleshooting.
