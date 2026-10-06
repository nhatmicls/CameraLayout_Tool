# Development Roadmap

## Done

- Floor-plan camera planner v1 foundation: image load, scale calibration, camera placement and DORI coverage, BOM, PNG + CSV export, save/load.
- Hikvision catalog expansion: IP/IK rating, audio, on-device analytics tags, per-shop prices and purchase links.
- Sensors: 11 records (PIR, IR beam, vibration, thermal) with official specs; coverage shapes, wall blocking rules, thermal banding.
- Walls: opaque and glass segments with camera cone occlusion and sensor wall blocking; live redraw, endpoint snap, undo/redo.
- Camera mounting + floor coverage: optional per-camera height and tilt with blind spot, far edge and DORI floor distances on the panel.
- Cables: hand-drawn routes from devices to hubs; cable types with optional length limit and user-entered VND/m prices; provisional length estimate (route + vertical runs + slack + waste %) with scale-click-error range; over-length warnings; vertex editing; BOM rows; PNG legend; project schema v5.

## Open

- **Hub-to-hub uplinks**: cables from hub to hub for daisy-chaining recorders or network switches.
- **Live cable follow during drag**: cable route updates in real time while dragging a device, not only when dropped.
- **Reel/box rounding**: round cable metres per type to reel or box multiples (e.g. 50 m reels, 1000 m boxes).
- **Per-cable device-height override**: override the default 3 m device height for individual cables (e.g. a camera at exactly 2.8 m).
- **Hub as a BOM line**: show hub count and model in the BOM (currently omitted, hubs are not priced).
- **CSV min/max metre columns**: export per-cable min/max range as separate columns (currently only the summary range is shown per type).
- **Playwright end-to-end suite**: automated UI tests (builds, exports, file load/save, undo/redo, deletion cascades).
- **Firefox/Safari export checks**: verify PNG and CSV export across browsers (currently verified in Chromium).
- **Full documentation set**: codebase overview, architecture, code standards, API guides, troubleshooting.
