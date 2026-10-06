# Project Changelog

## 2026-10-06

**Cables**: hand-drawn cable routes from devices (cameras/sensors) or hubs to hubs (switches, recorders, alarm panels). Feature set:
- **Hubs** (numbered H1, H2...): place with click, drag to move, mount height 1.5 m default, not priced.
- **Risers and drops** (R1... up arrow, D1... down arrow): the point where cables go up to the floor above / down to the floor below. Cables end on them like on a hub. Riser "Rises to" = height above this floor (starts at the route height); drop "Goes down to" = depth below this floor (starts at 0); optional "Length on the other floor" is added to every cable ending there.
- **Clear plan while routing**: camera cones and sensor coverage are hidden while "Draw cable" is on.
- **Cable routes**: draw by clicking device/hub start, route points, device/hub end. Edit with drag/double-click. Delete cameras/sensors/hubs removes their cables (one undo step). Types: Cat6 UTP (90 m limit), Power 2-core, Alarm signal - user adds/deletes, cannot delete type in use or last type.
- **Length estimate**: per-cable = horizontal route / scale + vertical runs (route height 3 m vs device / hub height) + slack (0.5 m device, 3 m hub) + waste 15 %; rounded up to whole metre per type. Range: worst case of scale click error (default 3 px), e.g. `30.8 m (30.6-31.1 m)`.
- **Over-length warning**: cable drawn red dashed when run exceeds type's length limit; "may exceed" when only at range max.
- **Vertex editing**: click cable, drag points, double-click line to add point, double-click point to delete.
- **BOM**: one row per cable type in use, quantity = whole metres. CSV/PNG column order: Type, Brand, Model, Form Factor, Resolution, Lens, Quantity, **Unit** (new; `pcs` or `m`), Labels, Unit Price (VND), Total (VND). Cable row has Type `Cable`, type name in Model, price per metre in Unit Price. Cables omitted from CSV when scale unset.
- **PNG export**: legend line with cable type names + total metres when cables present.
- **Approximations**: 2D route, straight segments, no conduit bends/obstacles; range does not cover image distortion or wrongly typed reference length; not a voltage-drop or PoE budget calc; sensors use default device height (3 m); cable ends update when device dropped (not during drag); no hub-to-hub links.
- **BREAKING**: Project schema version 5 (reader accepts 1-5; v5 file needs this build or newer). CSV/PNG table gained `Unit` column after `Quantity`.

## 2026-10-05

**Walls** (opaque/glass): draw segments on the plan; opaque blocks camera cones (live clipping), glass never does. Sensors: opaque + glass clip PIR/thermal; glass + opaque clip PIR/thermal (long-wave IR does not pass glass); vibration/glass-break only opaque; beams flagged as blocked/over-distance. Wall endpoints snap; cones and sensor coverage update live. Export in PNG. Undo/redo.

**Camera mounting + floor coverage**: optional per-camera mount height (metres) + downward tilt (degrees). Flat cone when unset. With mount: cone shows floor coverage (start at blind spot under camera, end at far edge or range limit). Panel shows blind spot, far edge, DORI floor distances, illumination range warning. Approximations: slant distance (sqrt(d²-h²)), centre-line arcs, fisheye >= 180° HFOV ignores tilt.

**Hikvision catalog expansion**: IP/IK rating, built-in mic/speaker, on-device human/vehicle/face/license-plate detection (copy from datasheet analytics print). Filter by outdoor (IP65+), mic, detection. Purchase links for 63 models (Shopee primary, secondary shop). Per-shop price on each card.

**Sensors**: 11 records (3 PIR motion, 3 IR beam, 3 vibration/glass-break, 2 thermal) across Hikvision, Dahua, Bosch, Takex. Coverage shapes: PIR sector (range/angle per datasheet, datasheet max never exceeded), IR beam line (TX/RX draggable, Indoor/Outdoor toggle, blocked/over-distance warning), vibration circle, thermal sector (banded by datasheet detection/recognition/identification, not DORI). Specs from official datasheets / install manuals only.

## 2026-10-05 (earlier)

**Floor-plan camera planner v1 foundation**: browser-only Vite + React + TypeScript + Konva. Load PNG/JPEG plan, calibrate scale (reference line + length). Camera catalog (106 records across Hikvision, Dahua, Axis) with official optical specs (resolution, lens, HFOV, illumination, DORI), IP/IK, audio, detection. Place cameras, rotate, adjust HFOV (varifocal), range. FOV cones shaded by EN 62676-4 DORI bands (Detect / Observe / Recognize / Identify). Filter by brand, form factor, price, outdoor, mic, detection. BOM grouped by model + lens with Vietnam street prices. PNG export (legend + BOM strip) + CSV export. Save/load as JSON. Undo/redo.
