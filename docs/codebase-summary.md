# Codebase Summary

> On conflict, `CLAUDE.md` and the code win. This document summarizes directory structure and key files rather than repeating binding rules in full.

## Repository Structure

**Top level**:
- `src/` — application source code
- `e2e/` — Playwright smoke tests (Chromium, dev server, port 4173)
- `data/` — catalog JSON records (camera, sensor, fire-alarm)
- `docs/` — user guides, architecture, standards, changelog, roadmap
- `index.html` — Vite entry page (repo root; there is no `public/` folder)
- `.github/workflows/` — GitHub Actions (`deploy-github-pages.yml`: tests, build, Pages deploy)

**Source structure** (every folder except `state` uses feature subfolders):

```
src/
├── catalog/
│   ├── camera/               → Loader, schema, feature filters / labels
│   ├── sensor/               → Loader, schema
│   ├── fire-alarm/           → Loader, schema
│   └── shared/               → Price / provenance schema, data-file ordering
├── domain/
│   ├── beam/                 → IR beam line check, beam end drag
│   ├── bom/                  → BOM row grouping per family, cross-floor merge, totals
│   ├── cable/                → Cable maths, labels, routes, cross-floor walking
│   ├── camera/               → Coverage resolver, DORI distances, mounted-camera floor coverage
│   ├── export/               → CSV serializer, export image layout
│   ├── fire-alarm/           → Designators, TCVN 5738 table, coverage, wall blocking, compatibility
│   ├── floor/                → Floor types, label allocator, floor list editing, image budget
│   ├── project-file/         → Project types, file schema (reader / writer), legacy migration
│   ├── sensor/               → Coverage resolvers, wall blocking rules
│   ├── view/                 → View config types, toggle table
│   ├── wall/                 → Occlusion polygon, wall geometry / editing
│   └── shared/               → Domain utilities
├── state/
│   ├── project-store.ts      → Project store (no subfolders)
│   ├── project-store-*.ts    → Action slices, write helpers, selectors, undo / redo
│   └── ... (all at root level)
├── canvas/
│   ├── beam/                 → Beam line + end markers
│   ├── cable/                → Cable / trunk / shaft-leg lines, labels, hub markers, drawing overlays
│   ├── camera/               → Camera icon + cone
│   ├── fire-alarm/           → Fire-alarm icon + detector coverage circle
│   ├── floor/                → Decoded image sync
│   ├── sensor/               → Sensor icon + coverage
│   ├── wall/                 → Wall lines + draggable node handles, drawing overlay
│   ├── stage/                → Stage, the Konva layers, pan / zoom
│   └── shared/               → Canvas utilities, colour palette, zoom cap scale
├── panels/
│   ├── app-shell/            → Toolbar, catalog sidebar, view panel, selection properties shell
│   ├── bom/                  → BOM panel
│   ├── cable/                → Cable / hub / shaft properties, estimate, per-cable list, settings
│   ├── camera/               → Camera catalog list, properties, DORI, mounting
│   ├── fire-alarm/           → Fire-alarm catalog lists, properties, compatibility
│   ├── floor/                → Floor tabs
│   ├── sensor/               → Sensor catalog list, properties, coverage
│   └── shared/               → Shared UI components
├── export/
│   ├── csv/                  → BOM and cable-length CSV
│   ├── png/                  → PNG canvas + legend + BOM strip
│   └── shared/               → Combined BOM rows, export file names, export actions hook
├── file-io/
│   ├── browser/              → File download, image read / decode
│   └── project-file/         → Project file save / load
├── app.tsx, main.tsx         → App shell and entry
└── dev-test-hooks.tsx        → Development-only test hooks
```

## Key Files by Area

### Catalog (`src/catalog/`)

- **Loaders**: read `data/*/camera-*/*.json`, `data/*/sensor-*/*.json`, `data/*/fire-alarm-*/*.json`; glob-based (add new brand/type folders without code change).
- **Schemas**: Zod definitions (camera specs, sensor specs, fire-alarm specs); source of truth for catalog shape.

### Domain (`src/domain/`)

| Area | Key files | Responsibility |
|------|-----------|---|
| **BOM** | `bill-of-materials-grouping.ts` + per-family groupers | Group placed items → BOM rows (`BomRow`, `computeBomTotal`, `bomToTable`, `bomToCsvTable`) |
| **Cable** | `cable-end-to-end-label.ts`<br>`buildProjectCableEndToEndLabels` | Derive `F{n}_device_F{m}_final_end` format; one label source |
| | `cable-endpoint-index.ts` | One floor's device / hub ends (position, label, height); `resolveCableEnd` |
| | `cable-length-estimate-calculator.ts`<br>`estimateCableLength` | Per-cable metres (horizontal + vertical + slack, then spare) |
| | `cable-layout-estimate.ts`<br>`computeCableLayoutEstimate` | Per-floor cable metres |
| | `project-cable-layout-estimate.ts`<br>`computeProjectCableEstimate` | Merge floors, round once per type; entry point for panels / BOM / export |
| | `project-cable-list-rows.ts`<br>`buildProjectCableListRows` | One row per cable (panel list + cable-length CSV) |
| | `cross-floor-route-walker.ts`<br>`walkCrossFloorRoute` | Only chain walker (metres + labels fold over it); hops shaft leg + riser/drop |
| | `cross-floor-exit-resolver.ts` | Where riser/drop pair leads |
| | `shaft-cable-leg.ts` | Per-cable route beyond shaft opening |
| **Fire alarm** | `fire-alarm-device-designator.ts` | Per-kind prefix table (S, H, P, etc.) |
| | `fire-alarm-kind-catalog-tab.ts`<br>`FIRE_ALARM_KIND_CATALOG_TAB` | Map kind → tab (control panel / fire alarm / sensors) |
| | `tcvn-5738-detector-protection-table.ts` | TCVN 5738 protection table + clause citations |
| | `fire-detector-coverage-resolver.ts` | Circle radius = `sqrt(A / pi)` |
| | `fire-detector-wall-blocking-rules.ts` | Which wall kinds block which detector kinds |
| **Floor** | `floor-item-label-allocator.ts`<br>`buildFloorItemLabels` | Shared per-prefix numbering; one label source |
| **Project file** | `project-file-schema.ts`<br>`parseProjectFile`, `serializeProject` | Schema v1–9 reader, v9 writer |
| | `project-file-legacy-flat-migration.ts` | Wrap a flat v1–6 file into one floor |
| | `../cable/shaft-shared-exit-migration.ts` | Migrate pre-v9 shared exits → per-cable routes |
| **Sensor** | `sensor-coverage-resolver.ts` | Clamp coverage to the datasheet at draw time |
| | `sensor-wall-blocking-rules.ts` | PIR / thermal clipped by opaque + glass; vibration by opaque only |
| **Wall** | `wall-occlusion-visibility-polygon.ts` | Full-disc visibility polygon for the occlusion clip |

### State (`src/state/`)

Entry point: `project-store.ts` (zustand + zundo). State / action types in `project-store-state-and-action-types.ts`; selectors in `project-store-floor-selectors.ts`; action slices in `project-store-*-actions.ts`; write helpers in `project-store-active-floor-update.ts`; undo / redo in `project-store-undo-redo.ts`. UI-only stores: `editor-ui-store.ts`, `catalog-sidebar-filter-store.ts`. Never use a selector that returns a fresh object / array as a hook selector.

### Canvas (`src/canvas/`)

Five Konva Layers only (image, cones, walls, markers, editor overlay). Cable labels in walls Layer children slot. No new Layer for any feature.

### Panels (`src/panels/`)

React components for the toolbar, floor tabs, catalog sidebar, properties and BOM. They change the project through store actions (floor content is patched via `patchActiveFloor` / `patchFloorById`).

### Export (`src/export/`)

- **Shared**: `buildCombinedBomRows` (`shared/build-combined-bom-rows.ts`; devices + cabling points + cable metres) for the panel, CSV and PNG.
- **CSV**: `exportBomCsv`; `exportCableLengthEstimateCsv` (rows from `buildProjectCableListRows`).
- **PNG**: plan drawing + legend + BOM strip (downscaled when too large). View-aware (fire-alarm devices are always drawn).

### File I/O (`src/file-io/`)

- **Browser**: `triggerBrowserFileDownload`, `readImageFileAsDataUrl`, `decodeEmbeddedImage`.
- **Project file**: `saveProjectToFile` / `loadProjectFromFile`; validation is `parseProjectFile` in `src/domain/project-file/` (bad cross-floor data: warn, drop, continue).

## Where to Change X

| Task | File(s) | Notes |
|------|---------|-------|
| Add camera catalog record | e.g. `data/hikvision/camera-bullet/hikvision-camera-bullet_02.json` | Keep ~25 records per file; start `_<NN+1>` when full |
| Add fire-alarm kind | `src/domain/fire-alarm/fire-alarm-device-types.ts` (`FireAlarmKind`) | Then the exhaustive tables `FIRE_ALARM_KIND_DESIGNATOR_PREFIX` and `FIRE_ALARM_KIND_CATALOG_TAB` |
| Add view toggle | `src/domain/view/view-config-toggle-table.ts`<br>`VIEW_TOGGLES` | One table, one source of truth |
| Change cable maths | `src/domain/cable/cable-length-estimate-calculator.ts`<br>`estimateCableLength` | Result type `CableLengthEstimate`; read through `computeProjectCableEstimate` |
| Change BOM rows | `src/export/shared/build-combined-bom-rows.ts`<br>`buildCombinedBomRows` | Row grouping per family is in `src/domain/bom/` |
| Change export filename | `src/export/shared/build-floor-export-file-name.ts` (PNG) | CSV names: `src/export/csv/`; project file: `deriveProjectFileName` in `src/file-io/project-file/project-file-save-and-load.ts` |

## Testing

**Layout**:
- Unit tests co-located: `src/**/*.test.ts` (Vitest, node environment, `npm test`).
- Fixtures: `src/**/*.test-fixtures.ts` (and `src/domain/project-file/project-file-test-fixtures.ts`).
- End-to-end smoke tests: `e2e/*.spec.ts` (Playwright, Chromium, dev server port 4173, `npm run test:e2e`).

**Guard tests**:
- `src/domain/no-react-konva-imports.test.ts` — enforce domain purity.
- `src/catalog/camera/camera-catalog-loader.test.ts`, `src/catalog/sensor/sensor-catalog-loader.test.ts`, `src/catalog/fire-alarm/fire-alarm-catalog-loader.test.ts` — a record sits in the folder of its own brand and form factor / kind.

## Commands

| Command | Purpose |
|---------|---------|
| `npm ci` | Install dependencies (use in CI) |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | `eslint .` |
| `npm test` | `vitest run` (single run) |
| `npm run test:e2e` | `playwright test` |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Serve the production build locally |

**Windows note**: a leftover dev server locks `node_modules` and breaks `npm ci` (EPERM); kill the whole process tree of anything you spawn.

## Other Documentation

- `./docs/system-architecture.md` — layers, state, export pipeline, cable subsystem
- `./docs/code-standards.md` — file naming, principles, patterns, testing workflow
- `./docs/tech-stack.md` — approved versions and decisions
- `./docs/user-guide-*.md` — four user guides (plan/cameras, sensors/alarm, floors/cables, BOM/export)
- `./docs/camera-catalog-sources.md` — datasheet source for every camera record
- `./docs/sensor-catalog-sources.md` — datasheet source for every sensor record
- `./docs/fire-alarm-catalog-sources.md` — datasheet source for every fire-alarm record
- `./docs/project-changelog.md` — dated record of features, fixes and breaking changes
- `./docs/development-roadmap.md` — done and open items

---

(See `CLAUDE.md` for complete layout rules, feature subfolder placement rules, and domain purity enforcement.)
