# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Camera Layout Tool: browser-only floor-plan camera planner (Vite + React 19 + TypeScript 5.9 +
Konva + zustand + Tailwind 4 + Zod). No backend, no runtime network calls. See `./README.md`
and `./docs/tech-stack.md`.

Commands: `npm run dev` | `npm run typecheck` | `npm run lint` | `npm test` (Vitest) |
`npm run build`. Run typecheck + test after every code change.

Layout: `data/` (catalog JSON, repo root), `src/catalog` (schema, loader), `src/domain` (pure logic),
`src/canvas` (Konva), `src/panels` (UI), `src/export` (PNG/CSV), `src/file-io`, `src/state`.
Every `src` folder except `state` is grouped into feature subfolders - put a new file in the
matching one, never loose at the folder root:
- `catalog/`: `camera`, `sensor`, `fire-alarm`, `shared`
- `domain/`: `beam`, `bom`, `cable`, `camera`, `export`, `fire-alarm`, `floor`, `project-file`, `sensor`, `view`, `wall`, `shared`
- `canvas/`: `beam`, `cable`, `camera`, `fire-alarm`, `floor`, `sensor`, `wall`, `stage`, `shared`
- `panels/`: `app-shell`, `bom`, `cable`, `camera`, `fire-alarm`, `floor`, `sensor`, `shared`
- `export/`: `csv`, `png`, `shared`
- `file-io/`: `browser`, `project-file`
A new feature gets its own subfolder where it adds files.
Catalog data: `data/<brand>/<device-type>/<brand>-<device-type>_<NN>.json`, where `device-type`
is `camera-<formFactor>` (bullet, dome, turret, ptz, fisheye), `sensor-<kind>` (pir, beam,
vibration, thermal), or `fire-alarm-<kind>` (control-panel, wireless-hub, expander-module,
keypad, keyfob, tag-reader, relay-module, repeater, communicator, power-supply, accessory,
smoke-detector, heat-detector, co-detector, manual-call-point, sounder, magnetic-contact,
environment-detector); e.g. `data/hikvision/camera-bullet/hikvision-camera-bullet_02.json`
or `data/hikvision/fire-alarm-smoke-detector/hikvision-fire-alarm-smoke-detector_01.json`. A
record must sit in the folder of its own brand and form factor / kind (tested). Loaders glob
`data/*/camera-*/*.json`, `data/*/sensor-*/*.json` and `data/*/fire-alarm-*/*.json`, so a new
numbered file, type folder or brand folder needs no loader edit. Keep a file to about 25
records and keep variants of one model in one file; start `_<NN+1>` when full. Only
`src/catalog` loaders read `data/`.

Project rules:
- `src/domain/**` must not import React, Konva (enforced by `no-react-konva-imports.test.ts`)
  or `src/catalog`.
- Positions are image px; rotation is degrees, 0 = +x, clockwise. `planPxPerMeter` (scale) and
  DORI px/m are different things - never mix them.
- Catalog optical specs (resolution, lens, HFOV, illumination, DORI) come only from the official
  manufacturer datasheet, copied as printed - never from memory, resellers or calculation.
  `priceVn` is the one exception: a Vietnamese reseller's displayed VND price, or `null`. Never
  invent or currency-convert a price. Record every source in `./docs/camera-catalog-sources.md`.
- Hikvision datasheets may also come from `hikvision.vn` (owner decision) when hikvision.com no
  longer hosts one. `purchaseLinks` (`primary` = the Shopee shop, `secondary` = another
  Vietnamese shop; each `{ shop, url, amountVnd, retrieved }`) is shop data like `priceVn`:
  copy the displayed selling price, `null` when the page shows none.
- Sensor catalog (`data/<brand>/sensor-<kind>/*.json`; PIR, beam, vibration, thermal) is
  separate from the camera catalog; ids are disjoint. Specs come only from the official
  datasheet or the manufacturer's own install manual, copied as printed (`dahuatech.com` is
  also accepted for Dahua sensors). One permitted calculation: a feet-only value is stored as
  ft x 0.3048 rounded to 0.1 m with `convertedFromFeet: true`. A kind with no official PDF
  ships zero records - never a placeholder. `priceVn` as for cameras; a beam price only when
  the page shows the TX+RX set price. Record every source in
  `./docs/sensor-catalog-sources.md`.
- Fire-alarm catalog (`data/hikvision/fire-alarm-<kind>/*.json`) is a third catalog; ids are
  disjoint from cameras and sensors. Hikvision only (AX HYBRID PRO and AX PRO lines). Specs
  come only from official Hikvision datasheets (hosts `hikvision.com` + subdomains, or
  `hikvision.vn`) or the AX PRO user manual, copied as printed. A kind with no official PDF
  ships zero records - never a placeholder. `priceVn` as for cameras. Record every source in
  `./docs/fire-alarm-catalog-sources.md`. A device from Hikvision's compatibility lists is
  added only when the EXACT model is sold in Vietnam (a saved Vietnamese shop page whose title
  / SKU carries the model string - a price or "Liên hệ" both count; `-WE` / `-WB` and "(B)"
  are distinct models) AND an official datasheet whose text contains that model string was
  downloaded. In practice that is the 433 MHz `-WB` and wired models; the 868 MHz `-WE`
  variants were not found in Vietnamese shops. Motion / glass-break detectors from those
  lists go to the sensor catalog; everything else is a marker-only kind here.
- Fire-alarm kinds: `FIRE_ALARM_KIND_CATALOG_TAB` (one table, one source of truth) maps each
  of 18 kinds to a tab ('control-panel', 'fire-alarm', or 'sensors'). Control panel tab shows
  controllers and their modules (expander, keypad, keyfob, tag reader, relay, repeater,
  communicator, power supply, accessory). Fire alarm tab shows detectors + call points + sounders.
  Sensors tab shows magnetic contact + environment detector (marker-only, placed like sensors).
  Detector coverage shapes (smoke/heat circles in TCVN 5738 mode only) are determined by kind,
  not stored in placement data.
- Compatibility (fire alarm): stored only on controller records (`compatibleDevices[]`), each
  with `sourceUrl` and `sourceRetrieved` date. Both ends must be in this catalog OR a sensor-catalog
  id, and both must appear in an official Hikvision source (AXPRO Series Compatibility List,
  AX HYBRID PRO Device Compatibility List). The printed minimum firmware goes in entry `note`.
  A "—" cell is read as compatible with all firmware versions (owner decision 2026-10-07).
  Frequency pairing (433 MHz hub `-WB` <-> `-WB` peripherals; 868 MHz hub `-WE` <-> `-WE`
  peripherals). Never inferred from protocol, series name or memory. UI says "not listed",
  never "incompatible". Placed sensor gets no warnings (only the filter). Placed alarm device
  shows "not listed" warning if not in a placed controller's list. Placed device is
  `{ id, modelId, x, y }`; circle is computed at draw time and never stored.
- Fire detector coverage: one project setting (`fireAlarmSettings { coverageMode, ceilingHeightM }`),
  modes "datasheet" or "tcvn-5738". TCVN 5738:2021 numbers and clause citations live only in
  `src/domain/fire-alarm/tcvn-5738-detector-protection-table.ts`. Circle radius derivation
  (`r = sqrt(A / pi)`) lives only in `src/domain/fire-alarm/fire-detector-coverage-resolver.ts`.
  Circle never stored or user-adjustable. Detector kind that has no protection area in TCVN
  (CO, above ceiling height, or no scale set) draws no circle. Wall blocking table
  `FIRE_DETECTOR_BLOCKING_WALL_KINDS` in `src/domain/fire-alarm/fire-detector-wall-blocking-rules.ts`
  is the single source; detectors drawn inside the cones Layer and the markers Layer - no new
  Konva Layer.
- Thermal is a sensor, banded by the datasheet's detection / recognition / identification
  distances - never DORI px/m, never `computeDoriBands` - and drawn as a flat cone only.
  Sensor coverage is clamped to the datasheet at draw time (`sensor-coverage-resolver.ts`).
- Placed sensors: `sector` (PIR, thermal; a ceiling PIR is a 360 sector), `circle` (vibration /
  glass-break), `beam` (two ends + `environment` indoor / outdoor choosing the datasheet
  maximum). Sensors draw inside the cones Layer and the markers Layer - no new Konva Layer.
- Vertical FOV (VFOV) fields (`vfovDeg`, `vfovWideDeg`, `vfovTeleDeg`) are optional: stored only
  when the datasheet prints a vertical angle, copied as printed. The runtime computes a fallback
  from HFOV and sensor aspect ratio and never writes it to the catalog JSON. A sensor's
  `vfovDeg` is shown only when printed and is never computed.
- Camera mounting (`mountHeightM` + `tiltDeg`, tilt = degrees down from horizontal) is optional
  and both-or-neither. Unset must draw and save exactly like the flat cone. Floor-coverage math
  lives in `src/domain/camera/mounted-camera-ground-coverage-calculator.ts` (metres only; slant model,
  centre-line arcs, fisheye HFOV >= 180 ignores tilt) - keep it out of components.
- Project = ordered `floors[]` (1 to `MAX_FLOORS` 20; tab 1 = lowest floor) + project-level
  `shafts`, `cableTypes`, `cableSettings`, `fireAlarmSettings`. A floor (`src/domain/floor/floor-types.ts`)
  owns `image` (nullable), `scale`, `cameras`, `sensors`, `walls`, `hubs`, `cables`,
  `fireAlarmDevices` and `floorHeightM` (floor-to-floor to the floor above, default 3.5). Ids and
  labels (`C{n}`, `S{n}`, `F{n}`, `H{n}`...) are per floor.
- Store: `floors[]` + `activeFloorId`; existing actions act on the active floor. Read through
  `src/state/project-store-floor-selectors.ts`; write through `patchActiveFloor` / `patchFloorById`
  (`project-store-active-floor-update.ts`), which also run the cross-floor + shaft prune. Never
  use a selector that returns a fresh object / array as a zustand hook selector. `activeFloorId`
  is untracked: a floor switch is not an undo step and never sets `hasUnsavedChanges`; undo / redo
  switches to the floor it changed (`project-store-undo-redo.ts`). A switch clears selection + tool
  and remounts the stage (keyed by floor id + project-load epoch); the view config is kept.
- Plan images stay inside `floors` and are tracked by reference (a replaced / deleted image stays
  in memory while undo can reach it). `decodedImage` is written only by
  `src/canvas/floor/use-active-floor-decoded-image-sync.ts`, keyed on the data URL.
- `setImage` acts on the active floor: clears that floor's scale, cameras, sensors, walls, hubs,
  cables and fire-alarm devices, prunes links / shaft markers that pointed at it, keeps cable
  types + settings and `fireAlarmSettings`, and is always ONE undo step - it never clears history
  (only `replaceProject` / `resetProject` do). An image load is pinned to the floor (and project
  load) it was started for (`floor-image-load-target-resolver.ts`); the image budget
  (`floor-image-budget.ts`) and the 80 MB save guard keep the saved file loadable.
- Project files: `PROJECT_SCHEMA_VERSION` is 7 (`floors[]` shape); the reader accepts 1 to 7 -
  flat v1-6 files are parsed by the legacy schema and wrapped into one floor - the writer always
  emits 7. The loader never rejects a file for bad cross-floor data: invalid links, trunks, shaft
  markers and exit choices are dropped with a warning.
- Cables: a cable is `{ device, hubId, typeId, points, exitFloorId? }` - `device` is a
  `{ kind, id, end? }` ref (`end` = `tx` / `rx`, for a beam only), `points` are the INTERMEDIATE
  vertices in image px, device -> hub; both ends derive from the live device / hub position
  (`src/domain/cable/cable-endpoint-index.ts`). A cable and its hub are on the same floor. Metres
  are never persisted. Deleting a camera, sensor or hub removes its cables in the same `set()`
  (one undo step); a cable type in use on ANY floor, or the last one, cannot be deleted (>= 1
  type always). A `Hub` is `{ id, x, y, mountHeightM, kind?, extraLengthM?, link?, trunk?,
  shaftId? }`; no `kind` = plain hub. Labels `H{n}` / `R{n}` / `D{n}` (per floor) and `T{n}`
  (shaft, from `shafts[]` order, same on every floor) come from `hubLabels`. Cones + sensor
  coverage are hidden in cable and trunk mode (`coverageVisible`).
- Riser / drop (`kind: 'riser' | 'drop'`): cables leave for the floor above / below. Typed mode
  (no partner route): `mountHeightM` (never negative) is the height it rises to / the depth below
  this floor (`hubEffectiveHeightM` negates a drop's) + optional `extraLengthM` = cable on the
  other floor. A riser on floor i may `link` to a drop on floor i + 1 (adjacent only, symmetric,
  one partner; linking to a point linked elsewhere is refused). A linked point may carry a
  `trunk { hubId, points }`: a route on ITS floor to a plain hub or another riser / drop (never a
  shaft marker). Computed mode (the partner has a trunk): vertical = the lower floor's
  `floorHeightM` (both `mountHeightM` ignored) + trunk at the partner floor's scale + the end at
  its target (chains continue; cycles = no metres).
- Shaft: project `shafts[] { id, name }` (max 20) + hub markers `kind: 'shaft'` with `shaftId`,
  at most one per shaft per floor; never linked. Every marker with a `trunk` is an exit (several
  allowed). A cable ending on a marker: no exit at all = 0 m at the marker + the marker's typed
  `extraLengthM` (no vertical); one exit = used implicitly; several = the cable's `exitFloorId`,
  never guessed - none chosen = NO metres, counted and named (`shaft-exit-not-chosen`). Vertical
  = sum of `floorHeightM` between entry and exit floor. Exit choices are stamped when a second
  exit appears and cleared when their exit goes; a shaft with no marker left is removed - each in
  the SAME `set()` as its cause. `cross-floor-exit-resolver.ts` is the only place that knows
  where a crossing point leads.
- Cable maths lives in `src/domain/cable/cable-length-estimate-calculator.ts`,
  `cable-layout-estimate.ts` (per-floor) and `project-cable-layout-estimate.ts`
  (`computeProjectCableEstimate` is the one entry point for panels, canvas, BOM and exports;
  returns per-floor estimates merged into project totals, cable metres summed and rounded once
  per type) - keep it out of components. The scale-error range applies to horizontal metres only
  (vertical runs and slack are typed in metres); the length limit checks the run without waste.
  No scale on any floor = no cable metres for that crossing: never use the `planPxPerMeter ?? 1`
  fallback for cables. Unestimated cables (missing a chosen exit, or crossing a scale-less floor)
  are counted and named, never guessed.
- Cable lines and trunk lines render in the walls Layer's children slot (after wall lines, before
  wall node handles); hubs and the selected cable/trunk vertex editor are in the markers Layer;
  the hub, cable and trunk tools share the one editor-overlay Layer - no sixth Konva Layer.
- Cable prices (VND/m per type) are user input: never invented, never prefilled. BOM rows
  carry `unit` (`pcs` / `m`); metres never count as unpriced items. BOM rows for the panel,
  CSV and PNG all come from `buildCombinedBomRows(project, { floorId? })` - one signature for
  all three. Pass `floorId` for that floor's rows only (unprefixed); omit for project-wide rows
  (floor-prefixed `F{n}_` when `floors.length > 1`; cable metres summed per type, rounded once on
  the total). CSV is always whole project (12 columns: 11 as before + trailing `Notes` for
  fire-alarm compatibility warnings); PNG can be current floor or all floors (fire-alarm rows
  filtered per floor, legend checked for that floor's device ids).
- Keyboard Delete / Backspace: acts only in select mode (a placed device is selected). When a
  catalog sidebar tab's drop-down (Brand, Type, "Works with") has focus, Delete / Backspace
  are ignored (no delete action).
- Walls are single segments in image px. For cameras `opaque` blocks and `glass` never does.
  For sensors the table `SENSOR_BLOCKING_WALL_KINDS` in
  `src/domain/sensor/sensor-wall-blocking-rules.ts` is the single source: PIR and thermal are clipped
  by opaque + glass, vibration by opaque only, beams are checked (blocked / over-distance
  state), not clipped. Occlusion is a
  full-disc visibility polygon in unrotated image axes
  (`src/domain/wall/wall-occlusion-visibility-polygon.ts`), applied as a Konva `clipFunc` on the
  cone's outer, unrotated Group - so rotation / HFOV changes never recompute it, and no blocking
  wall in range means no clip at all. Keep wall math in image px; convert metres only at the
  canvas edge.
- Konva drag events bubble: a draggable child's drag reaches its parent's drag handlers, so
  parent handlers must check `e.target === e.currentTarget`.
- Catalog sidebar filter state (`catalog-sidebar-filter-store.ts`): UI-only, never persisted.
  `catalogControllerFilter` is ONE shared "works with" selection read by the Sensors, Fire alarm
  and Control panel tabs (replaced tab-specific filters when the Control panel tab was added).
  A chosen controller model id, or 'all'. The filter appears in all three tabs' drop-downs,
  grouped into "Placed in this project" and "Not placed". Each tab also has its own brand and
  kind filters (merged union of sensor kinds + magnetic-contact/environment-detector for Sensors;
  fire-alarm detector kinds for Fire alarm; control-panel/hub and accessory kinds for Control panel).
- View config (`viewConfig` in `editor-ui-store.ts`, types + helpers in `src/domain/view/`) is
  UI-only: never persisted, never in undo, never sets `hasUnsavedChanges`. Items are hidden by id
  set (`hiddenIds`), never by filtering `cameras` / `sensors` - labels `C{n}` / `S{n}` and cable
  ends depend on the full arrays. Fire-alarm devices have no view toggle (always drawn). Walls
  hidden = lines and handles only; occlusion still applies. A beam (line + ends) is a sensor marker; a thermal cone
  is sensor coverage. A drawing tool forces its layers on through `resolveEffectiveViewConfig`
  (computed, never stored). The PNG drawing uses that effective config and the strip prints a
  "Shown / Hidden" note (`buildViewFilterNote`) only when something is hidden - all visible
  must stay identical to the pre-feature PNG. Legend lines, BOM panel, BOM strip, CSV and the
  cable estimate never follow the view. Labels for the panel and the note come from the one
  table `VIEW_TOGGLES`. The view is kept across a floor switch; it resets to `DEFAULT_VIEW_CONFIG`
  where a project (`replaceProject`) or a plan image (`setImage`) is loaded - at those UI call
  sites, never from `project-store`. Hidden ids and counts come from the active floor; trunk lines
  follow the cable-routes toggle, shaft markers the hubs toggle. Cones and sensor coverage shapes
  live in `plan-scene-coverage-layer.tsx`;
  markers in `plan-scene-markers-layer.tsx`; still no extra Konva Layer.
- Windows: a leftover dev server locks `node_modules` and breaks `npm ci` (EPERM). Kill the
  whole process tree of anything you spawn.
- `./plans/` is gitignored (local working notes), so do not link to it from committed docs.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*
