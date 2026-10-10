# Project Changelog

## 2026-10-10

**End-to-end cable labels + unified item numbering + BOM and export names (documentation updates and baseline architecture docs)**

- **End-to-end cable labels**: cables are now labelled `F{n}_device_F{m}_final_end` with both floors always shown - e.g. `F1_C3_F2_H1` (floor 1 cable 3 ending on floor 2 hub 1), `F1_C1_F1_H1` (same floor), `F1_C1_?` (unresolved end, typed riser/drop without a route, shaft cable not routed, or cycle). Riser / drop / shaft points are pass-through and never appear in the label. The label follows chains through riser / drop / shaft beyond the cable's final end. Labels are never unique: multiple cables may end on the same device. `buildProjectCableEndToEndLabels` is the one source (panels, canvas, PNG, BOM, CSV, warnings).
- **Shared per-prefix item numbering**: item labels are now numbered per floor PER PREFIX across kinds that share it - smoke + sensor share `S`, heat + plain hub share `H`, relay + riser share `R`, call point + expander share `E` - with order inside each prefix: cameras, fire-alarm devices, sensors, then hubs. Placing / deleting an item renumbers later items sharing its prefix. `buildFloorItemLabels` is the one source (canvas, panels, BOM, PNG, CSV, cable labels, warnings). Unknown fire-alarm model keeps prefix `F` (e.g. `F1_F1_H1`). A fire-alarm device whose model is no longer in the catalog is now labelled `?1`, `?2`... instead of `F{n}`, which read like a floor (owner decision 2026-10-10).
- **BOM labels**: all BOM labels always carry floor prefix `F{n}_` even in one-floor projects - canvas marker text and properties headings stay short (`C1`). Canvas and PNG labels on shaft legs are rendered at image resolution; editor scales them to a cap at 12 px screen radius so devices stay selectable at high zoom.
- **Cabling-point BOM rows**: hubs, risers, drops and shaft openings are now BOM rows (`Cable hub`, `Riser`, `Drop`, `Shaft opening`, unit `pcs`) with price cells printed `TBD` (not null), excluded from totals and the unpriced-items count; noted as 'cabling points priced TBD'. Shaft openings counted per marker (one per marker).
- **Export file names**: PNG exports renamed from `-camera-layout.png` to `-device-layout.png`; project file JSON renamed from `-camera-layout.json` to `-device-layout.json`. Old files with the old names still open. The `app` id inside the project file stays `camera-layout-tool` for backward compatibility.
- **Cable length estimate CSV**: a second CSV file `<stem>-cable_length_estimate.csv` is downloaded alongside the BOM when the project has a cable (single cable per row: Cable, Type, Length (+N% spare) (m), Notes). Lengths from `computeProjectCableEstimate` (`purchase`); per-cable lengths include the spare allowance (default 15%, editable under Allowances) and do not sum exactly to the BOM's whole metres (rounded once on the sum).
- **Spare vs. waste**: the cable allowance is displayed as "spare" in every UI string; the stored field remains `cableSettings.wastePercent` (no schema change). Existing projects show different numbers when a prefix is shared (e.g. sensor `S1` becomes `S2` next to a placed smoke detector) - no migration, the renumbering is live.
- **Baseline architecture docs**: three new documentation files describe the system: `docs/system-architecture.md` (Konva layers, data model, state, cable subsystem, export pipeline), `docs/codebase-summary.md` (repo structure, key files, where to change X), `docs/code-standards.md` (principles, file naming, pure functions, single-source patterns, units discipline, testing, workflow).
- **CLAUDE.md updates**: documented end-to-end cable labels, shared per-prefix numbering, BOM label floor prefix rule, cabling-point `TBD` rows, export file names, cable label rendering, two-file CSV export, spare vs. wastePercent terminology, cable walkers (`walkCrossFloorRoute`, `cross-floor-exit-resolver`, `shaft-cable-leg.ts`).

## 2026-10-09

- **Per-cable shaft routes**: each cable that ends on a shaft opening now has its own route
  beyond the shaft (replacing shared exits). A cable ending on an opening is labelled `C1-?`
  (not routed) until the route is drawn on the exit floor. The shaft panel on the exit floor
  lists incoming cables ("From Floor 2 C1"); select one and click "Route on <floor>" to draw
  a route from that floor's opening to a hub or device on that floor. The cable is then labelled
  by what it reaches (`C1-H1`, `S1-P1`; the shaft never appears in a label). Length includes
  the route on the entry floor + floor-to-floor heights + route on the exit floor (that floor's
  scale) + end + slack. Unrouted cables are counted up to the opening with the typed "Length
  beyond this opening" and a notice. Routes can be redrawn or removed from the same panel list.
- **Cable ends on any device**: a cable may now end on any device (camera, sensor, fire-alarm
  device) as well as a hub, riser, drop or shaft opening - not on its own start device. Start
  on a device, then click a hub (any kind) or another device to finish; start on a hub, then
  click a device. There are still no hub-to-hub cables. The label shows the start and the end,
  e.g. `S1-P1`, `C1-C2`. A device end uses that device's height (the default device height if it
  has none) and the device-end slack (0.5 m by default) instead of the hub-end slack (3 m).
  Deleting a device also removes the cables that end on it, in the same undo step.
- **Project file schema version 9**: adds the per-cable `beyondShaft` leg for shaft routes and
  refactors cable ends to support any device. Files from versions 1-8 still open: v7-8 files
  migrate unchanged, v1-6 files open as one floor. On load, files using the old shared shaft
  exits convert each cable's route to an owned copy, preserving the length; cables with no exit
  chosen open as "not routed". Builds older than this version refuse v9 files by version number.
- **Cables from fire-alarm devices**: the "Draw cable" tool now snaps to placed fire-alarm
  devices (panel, detectors, modules, contacts... every kind) as well as cameras and sensors. A
  cable's device end may be `{ kind: 'fire-alarm', id }`; its label uses the device's designator
  (`S1-H1`, `P1-H1`). Deleting the device removes its cables in the same undo step; a file whose
  cable points at a missing fire-alarm device loads with that cable dropped and a warning. A
  fire-alarm device has no mounting height, so the estimate uses the default device height.
- **Clicking a device under a selected cable selects the device** (fix): a click inside a
  camera, sensor or fire-alarm marker's hitbox now selects that device even when the selected
  cable ends on it. Before, the click stayed on the cable and Delete removed the cable instead of
  the device. Hub markers already behaved this way.
- **Project file schema version 8.** Same shape as 7 plus the fire-alarm cable end above. Files
  are saved as 8; version 7 and 1-6 files still open. A build from before this change refuses a
  version 8 file by its version number.
- **Fire-alarm designators**: placed devices are labelled by kind instead of the generic `F{n}` -
  control panel `P`, wireless hub `PW`, expander `E`, keypad `KP`, keyfob `KF`, tag reader `TR`,
  relay `R`, repeater `REP`, communicator `COM`, power supply `PS`, accessory `ACE`, smoke `S`,
  heat `H`, CO `CO`, call point `E`, sounder `SO`, magnetic contact `MAG`, environment `ENV`,
  intrusion detector `ID`. `F` remains only for a device whose model is unknown. Each prefix is
  numbered on its own per floor (`S1`, `S2`, `H1`...); expander and call point share one `E` series. Applies to canvas markers, properties panel, BOM labels / notes, CSV and PNG legend.
- **Marker size capped when zoomed in** (fix): camera, sensor, beam-end, fire-alarm and hub
  markers (icon + label) stop growing once the icon reaches 12 px radius on screen, so devices
  placed close together stay separable at a high zoom. Zoomed out they still shrink with the plan.
  Editor only - the PNG export keeps the image-px icon size. The cable / trunk snap radius follows
  the drawn icon.
- GitHub Pages deploy workflow (`.github/workflows/deploy-github-pages.yml`): test + build +
  publish on push to `main` or manual run. Base path set only in CI; local dev unchanged.

## 2026-10-08

**Wired 4-wire alarm devices (nhaantoan price list)**

- **Fire-alarm catalog 42 -> 57 records** (62 with the no-datasheet devices below): 2 wired magnetic contacts, 2 wired sounders, 2 wired
  panic buttons, 2 four-wire smoke detectors (DS-PDSMK-4, DS-PDSMK-4BAR), the Speed-X power relay
  expander DS-PM1-O4H-H and 6 detector mounting brackets (first records of the accessory kind).
- **Sensor catalog 26 -> 31 records**: wired DS-PDP18-EG2, DS-PDD12P-EG2, DS-PDCL12-EG2,
  DS-PDTT15AM-LM (PIR) and DS-PDBG8-EG2 (glass-break).
- **Prices** from the owner's nhaantoan.com price list for the 20 new records and 6 existing
  ones (DS-PDSK-P changes from 405,000 to 720,000 VND).
- **Compatibility**: the three AX Hybrid PRO panels now also list the wired 4-wire devices and
  the brackets by owner decision (each entry says so; they are not rows of Hikvision's list),
  so these devices are no longer flagged "not listed" next to an AX Hybrid PRO panel.
- **Devices with no datasheet** (owner decision): DS-PD1-BG9, DS-PD2-T12AME-EL,
  DS-PDB-EX-Adapter, DS-PDB-EX-Fixedbracket and AoLin SH-507H are in the catalog with "no
  datasheet" on the card (fire-alarm catalog 62 records in total). The two detectors use the new
  marker-only kind "Intrusion detector" (Sensors tab, no coverage shape). SH-507H is the first
  record of a second brand, AoLin, so the Fire alarm tab's Brand filter now has two entries.
  The alarm catalog's `sourceUrl` may be `null`.

**Renamed to Security Layout Planner**

- The app, the package (`security-layout-planner`) and the repository are renamed from "Camera Layout
  Tool": it now plans cameras, sensors, alarm devices and cabling. Not breaking: project files
  keep the `app` id `camera-layout-tool` and PNG exports keep the `-camera-layout.png` suffix.
- **Docs**: the README is now a short overview; the feature details moved unchanged into
  `docs/user-guide-*.md` and `docs/local-setup.md`.

**Multi-floor projects**

- **BREAKING: project file schema version 7.** A project is now a list of floors. Files from
  versions 1-6 still open (as a one-floor project); a file saved by this version needs this
  version or newer.
- **BREAKING (several floors only): PNG file names.** A project with more than one floor exports
  `F{n}-<floor name>-<image name>-camera-layout.png`. A one-floor project keeps the old names,
  and its BOM rows, CSV text and PNG table are unchanged.
- **Floors**: 1 to 20 floors as tabs (add, rename, reorder, delete), each with its own plan
  image, scale, cameras, sensors, walls, hubs, cables and alarm devices, numbered per floor.
  Cable types, cable allowances, the fire-detector coverage settings and shafts belong to the
  project. Each floor has a floor-to-floor height (default 3.5 m).
- **Undo**: switching floors is not an undo step; undo / redo goes to the floor it changed.
  Replacing a floor's plan image is now ONE undo step and no longer clears the undo history
  (it clears that floor only, and no longer resets the fire-detector coverage settings).
- **Riser / drop links**: a riser can be linked to a drop on the floor above ("Create paired
  point" or pick one). A linked point can carry a drawn route to a hub on its floor, editable
  point by point like a cable. With a route, cables ending on the partner point are measured as
  own route + floor-to-floor height + the route at that floor's scale + the drop at the hub,
  and the typed height / length are ignored. Without a route the typed values apply as before.
- **Shafts**: a vertical tube with one opening per floor (`T1`, `T2`...). Every opening with a
  route is an exit; a shaft can have several. One exit is used implicitly; with several each
  cable must choose (label `C1-T1>F3`), and a cable with no choice has no length and is counted
  as "not estimated" in the BOM panel, the CSV message and the PNG. No exit at all = the typed
  "length beyond this opening". A route cannot end on a shaft opening.
- **Cable estimate**: each floor is measured with its own scale; a cable whose run crosses a
  floor without a scale has no length and is reported. A cable type in use on any floor cannot
  be deleted.
- **BOM / CSV / PNG**: one BOM for the project - the same model on several floors is one row,
  labels carry a floor prefix (`F2_C1`) when the project has more than one floor, cable metres
  are summed over floors and rounded up once per type. The BOM panel has an "All floors" / per
  floor filter. The CSV always covers the whole project. "Export PNG" exports the current floor;
  "Export all floors" downloads one PNG per floor that has a plan and a scale. A panel / hub on
  any floor counts as placed for alarm-device compatibility.
- **Limits**: plan images are saved inside the project file (80 MB limit; adding an image that
  would pass it is refused). A replaced or deleted plan image stays in memory while undo can
  still bring it back.
- **Tests**: first Playwright end-to-end smoke tests (Chromium, against the dev server on port
  4173, because the test hooks exist only in dev builds).

## 2026-10-07 (continued)

**Fire alarm / alarm panels** (AX HYBRID PRO expansion): 28 additional Hikvision alarm-device records (magnetic contacts, a temperature detector, smoke / heat / CO detectors, keypads, a keyfob, emergency buttons, sounders, relay modules, a repeater, the bus wireless receiver, communicator modules) added from the AX HYBRID PRO Device Compatibility List - only models sold in Vietnam with official datasheets (433 MHz `-WB` and wired variants; 868 MHz `-WE` variants and 6 datasheet-less models excluded). Fire-alarm catalog grows from 12 to 40 records. Feature set:

- **New marker-only kinds** (no coverage circle): magnetic-contact, environment-detector, keyfob, tag-reader, relay-module, repeater, communicator, power-supply, accessory. Grouped by `FIRE_ALARM_KIND_CATALOG_TAB` into tab assignment (Control panel tab vs Fire alarm tab vs shared with Sensors tab).
- **Control panel tab** (new sidebar tab): shows the 2 control panels + 2 wireless hubs and their modules (expanders, keypads, keyfob, relay modules, repeater, communicators; tag-reader, power-supply and accessory kinds have no records yet). Controllers show a "Compatible devices in this catalog" count with a "View list" popup; placed modules follow the same "not listed" warning rules as other alarm devices. Filter by brand and kind; "Works with" drop-down shared with Sensors and Fire alarm tabs.
- **Sensor catalog growth**: 12 new records (10 PIR variants, 1 glass-break, 1 PIR-glass-break combo) from the AX HYBRID PRO motion-detector section, all sold in Vietnam with official datasheets. Sensor catalog grows from 13 to 23 records (14 PIR, 3 IR beam, 4 vibration, 2 thermal). Sensor tab now allows filtering by "Works with" controller.
- **Catalog sidebar filters**: Brand and Type drop-downs (not type buttons) in Sensors, Fire alarm and Control panel tabs; shared "Works with" drop-down listing controllers grouped "Placed in this project" / "Not placed". Choosing a controller shows only devices named in its official compatibility list.
- **Compatibility**: controller-centric (stored on control-panel / wireless-hub records only). A "—" cell on the AX HYBRID PRO list is read as all firmware versions (owner decision). Frequency pairing: 433 MHz hub (`-WB`) <-> `-WB` peripherals; 868 MHz hub (`-WE`) <-> `-WE` peripherals. Placed sensors get no warnings (filter only). Placed alarm devices show "not listed" warning if absent from a placed controller's list.
- **Prices**: fire-alarm devices are mostly "price on request" (11 of 40 have a Vietnamese price (vuhoangtelecom.vn); 21 more link to a contact-for-price page on mastery.vn; no Shopee listing could be verified).
- **Wired devices (second pass)**: 3 wired motion detectors (DS-PDC10AM-VG3, DS-PDC10DM-VG3, DS-PDD15AM-EG2) in the sensor catalog, a wired magnetic contact (DS-PD1-MC-RS) and 1 control panel (DS-PHA48-EP(B), with the AX HYBRID PRO list's second-column entries). Totals: 42 alarm records, 26 sensor records. 25 more wired models sold in Vietnam are not added: no valid datasheet for the exact model (owner decision). The older DS-PHA20-W2P panel is left out because no official compatibility list covers it.
- **Keyboard**: Delete / Backspace act only in select mode; ignored when a drop-down has focus.
- **No breaking changes**: sidebar tab switch is UI-only.

## 2026-10-07

**View**: layer visibility toggles for the plan and PNG export. Feature set:

- **Toggles**: 16 toggles on a collapsible panel section: camera markers, camera FOV cones, each camera form factor (bullet, dome, turret, PTZ, fisheye), sensor markers (including IR beam line + ends as one group), sensor coverage shapes (including thermal cones), each sensor kind (PIR, IR beam, vibration, thermal), hubs / risers / drops, cable routes, and walls. Every option always listed with live item count.
- **UI**: collapsed section; "N hidden" badge when any are off; "Show all" button resets all to visible.
- **Visibility effect**: camera cones, sensor coverage and cable lines clipped to the visible set; hidden items (except walls) are not rendered. Hidden walls still apply occlusion / blocking to visible cones and beams. Fire-alarm devices and their coverage are always drawn (no toggle).
- **Drawing tools**: wall tool, hub/riser/drop tool and cable tool each force their layers on while active (computed per call, never stored), restored on leaving the tool.
- **PNG export**: drawing uses the on-screen (tool-effective) view config. Legend lines, BOM strip, BOM panel, CSV and cable estimate always cover everything. When anything is hidden the strip prints a wrapped "Shown: ... / Hidden: ..." note (`buildViewFilterNote`) under legend lines; no hidden items = PNG identical to pre-feature export.
- **State management**: UI-only (`viewConfig` in `editor-ui-store.ts`), never persisted, never in undo, never sets `hasUnsavedChanges`. Items hidden by id set (`hiddenIds`), not by filtering arrays - labels C{n}/S{n} never renumber. Reset to show-all when a project or a new plan image is loaded (at two UI call sites in `app.tsx` and `use-project-file-actions.ts`). Selecting an item then hiding its type clears the selection. Dropping a catalog card of a hidden type reveals that type with an info notification.

**Fire alarm / alarm panels**: third device family (Hikvision only, 12 records). Feature set:
- **Catalog**: 2 AX Hybrid PRO control panels, 1 wired expander, 1 keypad, 2 AX PRO 868 MHz wireless hubs, wireless detectors (smoke / heat / CO, one each), 1 wireless sounder, 1 emergency button, 1 standalone smoke alarm. Specs from official Hikvision datasheets (hikvision.com / hikvision.vn) and AX PRO user manual, copied as printed. One record has a Vietnamese price; the rest "price on request".
- **Placement**: drag card onto plan (scale required like sensors); devices numbered F1, F2...
- **Coverage modes**: "Datasheet" (markers only, no detector prints a protection area); "TCVN 5738" (dashed circle for smoke / heat from table, equal-area radius `r = sqrt(A / pi)`, ceiling height input, smoke up to 12 m, heat up to 9 m per clauses 6.13 Bảng 1 and 6.15.1 Bảng 2). Circle approximates area + spacing-grid (corners leave gaps), omits beams/projections/room shape/document conditions. CO, above ceiling height, or no scale: no circle. Circles clipped by opaque + glass walls (0.3 m rule).
- **Compatibility**: stored on controller records (panels, hubs) only, with official source URL per entry. Cards show "Compatible devices in this catalog". Warnings: "not listed" for any placed panel/hub, aggregated "No panel/hub placed" when none. "Not listed" = no official statement, not incompatibility proof. Standalone devices exempt. Capacity shown as printed (display only).
- **BOM**: fire rows after sensors, grouped by kind, unit `pcs`, labels F1, F4. CSV trailing column `Notes` (breaking change for strict parsers) filled with compatibility warning or "No panel/hub placed". PNG legend gains fire line. PNG table unchanged (11 cols).
- **BREAKING**: Project schema version 6 (reader 1-6; v6 file needs this build+). CSV gained 12th trailing `Notes` column.

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
