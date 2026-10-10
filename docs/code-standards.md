# Code Standards

> On conflict, `CLAUDE.md` and the code win. This document summarizes principles and patterns rather than repeating binding rules in full.

## Principles

**YAGNI** (You Aren't Gonna Need It): implement only what is needed now. No speculative architecture, no "someday" features, no over-engineered abstractions.

**KISS** (Keep It Simple, Stupid): prefer straightforward code over clever tricks. Readability beats brevity. One concept per function / file.

**DRY** (Don't Repeat Yourself): extract repeated logic into shared utilities. One responsibility per module.

**Real implementations, no mocks**: unit tests use actual data and logic, never fake "pass the test" shortcuts. Failing tests are fixed properly, not weakened.

## File Naming and Structure

**Naming**: kebab-case with descriptive names — long file names are fine, they self-document for LLM tools (Grep, Glob, Search).
- Example: `cable-end-to-end-label.ts`, `fire-detector-coverage-resolver.ts`, `wall-occlusion-visibility-polygon.ts`.

**File size**: keep code files under 200 lines. Large files are split at logical boundaries (functions, classes, concerns).

**Feature subfolders**: every `src` folder except `state` is grouped into feature subfolders; a new feature gets its own subfolder where it adds files:
- `src/domain/cable/` — cable maths, labels, routes
- `src/canvas/cable/` — cable drawing components
- `src/panels/cable/` — cable properties + controls

Never put a new file loose at a `src/<area>` folder root - use the matching feature subfolder (or `shared/`).

## TypeScript and React Patterns

### Pure Domain (`src/domain/`)

- No React imports, no Konva imports (enforced by `src/domain/no-react-konva-imports.test.ts`), no `src/catalog` imports - a catalog lookup is passed in as an argument.
- Testing: co-located `*.test.ts` with fixtures (`*.test-fixtures.ts`).

### Derived, Never Stored

- **Item labels**: computed at read time from `buildFloorItemLabels(floor, ctx)`, never stored in floor. Derived from array positions per floor per shared prefix.
- **Cable labels**: computed from `buildProjectCableEndToEndLabels(project, fireAlarmModelById?)`, never stored. Format `F{n}_device_F{m}_final_end`.
- **Cable endpoints**: from `resolveCableEnd(end, index)` against the floor's `buildCableEndpointIndex(...)`, live device / hub position. Never cached in cable.
- **Cable metres**: from `computeProjectCableEstimate(project, fireAlarmModelById?)`, never persisted. Rounded once per type on project total.
- **Coverage circles**: computed at draw time by resolvers, never stored. Detector circles only in TCVN 5738 mode.
- **Wall occlusion polygons**: computed at draw time, applied as a Konva clip.

### Single-Source Pattern

One function / table as the authority for each concept:

| Concept | Source | File |
|---------|--------|------|
| Item labels | `buildFloorItemLabels` | `src/domain/floor/floor-item-label-allocator.ts` |
| Cable labels | `buildProjectCableEndToEndLabels` | `src/domain/cable/cable-end-to-end-label.ts` |
| Cable estimate | `computeProjectCableEstimate` | `src/domain/cable/project-cable-layout-estimate.ts` |
| BOM rows | `buildCombinedBomRows` | `src/export/shared/build-combined-bom-rows.ts` |
| Fire-alarm kind → prefix | `FIRE_ALARM_KIND_DESIGNATOR_PREFIX` | `src/domain/fire-alarm/fire-alarm-device-designator.ts` |
| Fire-alarm kind → tab | `FIRE_ALARM_KIND_CATALOG_TAB` | `src/domain/fire-alarm/fire-alarm-kind-catalog-tab.ts` |
| View toggles | `VIEW_TOGGLES` | `src/domain/view/view-config-toggle-table.ts` |
| Sensor wall blocking | `SENSOR_BLOCKING_WALL_KINDS` | `src/domain/sensor/sensor-wall-blocking-rules.ts` |
| Fire-detector wall blocking | `FIRE_DETECTOR_BLOCKING_WALL_KINDS` | `src/domain/fire-alarm/fire-detector-wall-blocking-rules.ts` |

Never duplicate these. Panel UI, canvas, export, all query the source (never hardcoded lists).

### Zustand State

- **Never a selector hook returning fresh objects** (arrays, objects created in the selector): the hook then sees a new value on every store update.
  ```typescript
  // BAD: `selectProject` builds a new object on every call
  const project = useProjectStore(selectProject)

  // GOOD: select stable slices, assemble with useMemo (as `use-project-cable-estimate.ts` does)
  const floors = useProjectStore((s) => s.floors)
  const shafts = useProjectStore((s) => s.shafts)
  const cameras = useProjectStore(selectCameras) // returns the active floor's own array
  ```
- **Write via store actions**; floor content is patched through `patchActiveFloor` / `patchFloorById` (`project-store-active-floor-update.ts`), which also run the cross-floor + shaft prune.
- **Read via selectors** in `project-store-floor-selectors.ts`.

### Memoisation Pattern

Single-slot reference memo at module level (reference equality on the inputs, not value equality) - the app has exactly one live project, and every edit produces a new `floors` array:

```typescript
// Shape of the cache in `computeProjectCableEstimate` (project-cable-layout-estimate.ts)
let cachedKey: { floors: Floor[]; shafts: Shaft[]; cableTypes: CableType[]; cableSettings: CableSettings } | null = null
let cachedResult: ProjectCableEstimate | null = null

if (cachedKey && cachedKey.floors === project.floors && /* ...same for the other inputs */ true) return cachedResult!
```

Used by `computeProjectCableEstimate` and `buildProjectCableEndToEndLabels`; `buildFloorItemLabels` keeps one slot per floor object in a `WeakMap`.

### Konva Drag Events

Drag events bubble: a draggable child's drag reaches its parent's drag handlers.
```typescript
// ❌ BAD: parent receives child drag
const parentDragHandler = (e: KonvaEventObject<DragEvent>) => { /* moves parent */ }

// ✅ GOOD: check target
const parentDragHandler = (e: KonvaEventObject<DragEvent>) => {
  if (e.target === e.currentTarget) { /* only move parent */ }
}
```

### No New Konva Layers

Five layers are fixed: image, cones, walls, markers, editor overlay. Cable labels drawn in walls Layer children slot (not a separate layer). Fire-detector coverage circles are drawn in the cones Layer (not a new layer). New features reuse existing layers.

## Units Discipline

- **Image coordinates**: positions and route points are image pixels. Rotation is degrees, 0 = +x, clockwise. Wall math stays in image px; convert metres only at the canvas edge.
- **Never mix** `planPxPerMeter` (plan scale, image px per metre) with DORI px/m (`DORI_PX_PER_METER`, pixel density on the target, EN 62676-4).
- **No fallback**: cable lengths never use `planPxPerMeter ?? 1` (no scale = no metres; the cable is counted and named as unestimated, never guessed).
- **Mount heights, slack, floor heights**: always metres. The spare allowance is a percent (`cableSettings.wastePercent`).

## Catalog Data Rules

- **Specs come from official datasheet only**: resolution, lens, HFOV, illumination, DORI (camera); range, angle, thermal bands (sensor); fire-alarm specs from official Hikvision datasheets / the AX PRO user manual. Never from resellers, memory, or calculation (one exception: a feet-only sensor value stored as ft × 0.3048 with `convertedFromFeet: true`).
- **Price**: Vietnamese reseller displayed price, or `null`. Never invented or currency-converted. Record every source in `docs/camera-catalog-sources.md`, `docs/sensor-catalog-sources.md` or `docs/fire-alarm-catalog-sources.md`.
- **Files**: `data/<brand>/<device-type>/<brand>-<device-type>_<NN>.json`, ~25 records per file, increment `<NN>` when full.
- **Source links**: each record's `sourceUrl` + `sourceRetrieved` date (a fire-alarm record's `sourceUrl` may be `null`). Hikvision datasheets also accepted from `hikvision.vn` (owner decision).

## Comments

**Comment the WHY, not the WHAT**: code is self-documenting; comments explain intent, rationale, owner decisions.

```typescript
// ✅ GOOD: explains why
// A legal chain visits each (floor, hub) at most once, so the visited set
// alone terminates the loop - no depth limit needed.

// ❌ BAD: just repeats code
// Check if the key is in the visited set
```

**Owner decisions**: include date and context.
```typescript
// Owner decision 2026-10-09: smoke detector and sensor share the S prefix,
// with smoke (fire-alarm) numbered first, then sensors.
```

## Naming Split

- **Displayed term**: "spare" (user sees this in every cable-related UI string: "Spare", "Length (+N% spare)").
- **Stored field**: `cableSettings.wastePercent` (no schema change; internal identifier).
- **Pattern**: never rename the field, use the displayed term in UI only.

## Testing

**What needs tests**:
- Pure domain functions (`src/domain/`): unit test with fixtures.
- State actions: test store updates via actions.
- Maths: test edge cases (zero, negative, max values).
- Project file: older-version files (flat v1–6, v7, v8) still load.

**What doesn't** (Vitest only runs `src/**/*.test.ts`, node environment):
- React component rendering: covered by Playwright e2e smoke tests (Chromium, dev server).
- Konva drawing and UI interaction: e2e tests.

**Fixtures** (`*.test-fixtures.ts`): worked-example projects, floors, cables. Named for clarity.
```typescript
// src/domain/cable/cross-floor-worked-example.test-fixtures.ts
export function twoFloorLinkedProject(overrides = {}): Project {
  // ... two floors, a linked riser / drop pair and one cable
}
```

**Never weaken a failing test** to pass the build. Fix the code or the test design (not the assertion).

## Workflow

**Checks**:
1. `npm run typecheck` + `npm test` — after every code change.
2. `npm run lint` — before commit.
3. `npm test` — before push. The Pages deploy workflow runs `npm ci`, `npm test`, then the build.

**Commit message** (conventional commits, no AI references):
```
fix(cable): end-to-end label includes both floors

Cable labels now show start and final end floors per owner decision
2026-10-09, format F{n}_device_F{m}_final_end.
```

**No secrets in commits**: never commit `.env`, credentials, API keys, database passwords. `.gitignore` catches `.env*`, but double-check before push.

**Changelog and roadmap**: update `docs/project-changelog.md` and `docs/development-roadmap.md` after significant changes (features, breaking changes, bug fixes).

**Documentation updates**: part of feature implementation, not a follow-up task. User guides and architecture docs live in `./docs/` and stay in sync with code.

---

(See `CLAUDE.md` for complete rules on catalog data, file structure, domain purity, store patterns, and cable subsystem.)
