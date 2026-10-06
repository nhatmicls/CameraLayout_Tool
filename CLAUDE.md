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
- `catalog/`: `camera`, `sensor`, `shared`
- `domain/`: `beam`, `bom`, `cable`, `camera`, `export`, `project-file`, `sensor`, `wall`, `shared`
- `canvas/`: `beam`, `cable`, `camera`, `sensor`, `wall`, `stage`, `shared`
- `panels/`: `app-shell`, `bom`, `cable`, `camera`, `sensor`, `shared`
- `export/`: `csv`, `png`, `shared`
- `file-io/`: `browser`, `project-file`
A new feature (fire alarm, ...) gets its own subfolder where it adds files.
Catalog data: `data/<brand>/<device-type>/<brand>-<device-type>_<NN>.json`, where `device-type`
is `camera-<formFactor>` (bullet, dome, turret, ptz, fisheye) or `sensor-<kind>` (pir, beam,
vibration, thermal); e.g. `data/hikvision/camera-bullet/hikvision-camera-bullet_02.json`. A record
must sit in the folder of its own brand and form factor / kind (tested). Loaders glob
`data/*/camera-*/*.json` and `data/*/sensor-*/*.json`, so a new numbered file, type folder or
brand folder needs no loader edit. Keep a file to about 25 records and keep lens variants of one model in one file;
start `_<NN+1>` when full. Only `src/catalog` loaders read `data/`.

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
- Project files: `PROJECT_SCHEMA_VERSION` is 5 (v4 + optional `hubs`, `cables`, `cableTypes`,
  `cableSettings`); the reader accepts 1 to 5, the writer always emits 5.
- Cables: a cable is `{ device, hubId, typeId, points }` - `device` is a `{ kind, id, end? }`
  ref (`end` = `tx` / `rx`, for a beam only), `points` are the INTERMEDIATE vertices in image
  px, device -> hub; both ends derive from the live device / hub position
  (`src/domain/cable/cable-endpoint-index.ts`). Metres are never persisted. Deleting a camera,
  sensor or hub removes its cables in the same `set()` (one undo step); a cable type in use,
  or the last one, cannot be deleted (>= 1 type always). `setImage` clears hubs + cables and
  keeps cable types + settings. A riser / drop (cables leave for the floor above / below) is a `Hub`
  with `kind: 'riser' | 'drop'`: `mountHeightM` (never negative) is the height it rises to /
  the depth below this floor (`hubEffectiveHeightM` negates a drop's), optional
  `extraLengthM` = cable on the other floor; labels `H{n}` / `R{n}` / `D{n}` come from
  `hubLabels`. Cones + sensor coverage are hidden in cable mode
  (`coverageVisible`).
- Cable maths lives in `src/domain/cable/cable-length-estimate-calculator.ts` +
  `cable-layout-estimate.ts` (`computeCableLayoutEstimate` is the one entry point for panels,
  canvas, BOM and exports) - keep it out of components. The scale-error range applies to
  horizontal metres only (vertical runs and slack are typed in metres); the length limit
  checks the run without waste. No scale = no cable metres: never use the
  `planPxPerMeter ?? 1` fallback for cables.
- Cable lines render in the walls Layer's children slot (after wall lines, before wall node
  handles); hubs and the selected cable's vertex editor are in the markers Layer; the hub
  and cable tools share the one editor-overlay Layer - no sixth Konva Layer.
- Cable prices (VND/m per type) are user input: never invented, never prefilled. BOM rows
  carry `unit` (`pcs` / `m`); metres never count as unpriced items. BOM rows for the panel,
  CSV and PNG all come from `src/export/shared/build-combined-bom-rows.ts`.
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