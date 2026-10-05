# Tech Stack

Approved 2026-10-05. Browser-only app, no backend. Builds to a static folder.

## Runtime environment

- Node 20.19.x, npm 10.x (dev machine: Windows 11)
- Target browsers: current Chrome, Edge, Firefox. Safari works with a reduced export size (see Known limits).

## Stack

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Build | Vite | 8.3.x | Requires Node ^20.19 or >=22.12 |
| UI | React + react-dom | 19.3.x | |
| Language | TypeScript | 5.9.x | Fell back from 7.0.x in phase 1: `typescript-eslint` 8.71.0 peer-depends on `typescript >=4.8.4 <6.1.0`, so TS 7 cannot be linted. Using 5.9.3. |
| Canvas | konva + react-konva | 10.7.x / 19.3.x | Drag, rotate, wedge shapes, high-res export |
| State | zustand (+ zundo for undo/redo) | 5.0.x / 2.3.x | Single project store |
| Styling | Tailwind CSS | 4.3.x | No component kit |
| Validation | Zod | 4.x | Catalog file and loaded project files |
| Unit tests | Vitest | 4.1.x | Vitest 5 needs Node 22.12+, do not upgrade on Node 20 |
| E2E tests | Playwright | 1.63.x | |
| File I/O | Native `<input type=file>` + download link | - | No library |
| CSV | Hand-written serializer | - | No library |

## Decisions and rationale

- **Konva over Fabric.js**: Fabric has known hit-testing bugs on overlapping semi-transparent shapes, which is what overlapping FOV cones are.
- **Konva over plain SVG**: SVG to PNG rasterisation with an embedded floor-plan image is unreliable across browsers; export is the core feature.
- **React over Svelte 5**: stronger Konva bindings and documentation. Bundle size is not a constraint for a one-screen tool.
- **No component kit, no file/CSV libraries**: about 10 UI controls and about 20 lines of file handling; a dependency costs more than it saves.
- **Geometry stays in pure functions** with no Konva imports, so the math is unit-testable and the canvas library is replaceable.

## Known limits

- Safari/iOS caps a canvas at roughly 16.7M pixels. Exports above the limit are downscaled with a notice.
- Konva has a single main maintainer.
- Performance with a very large scan (6000x4000) plus 40 cameras is unbenchmarked; verify early.

## Phase 1 version decisions (recorded 2026-10-05)

Exact versions installed, verified against npm registry on 2026-10-05 and checked for mutual peer-dependency
compatibility: vite 8.3.2, react/react-dom 19.3.0, typescript 5.9.3 (see fallback note above), konva 10.7.0,
react-konva 19.3.0 (peer-requires react/react-dom `^19.3.0`), zustand 5.0.15, zundo 2.3.0 (peer-requires zustand
`^5.0.0`), tailwindcss 4.3.3 + @tailwindcss/vite 4.3.3, zod 4.6.5, vitest 4.1.11 (4.1 branch - Vitest 5 needs Node
22.12+, this machine runs Node 20.19.6), @playwright/test 1.63.0, @vitejs/plugin-react 6.1.1, eslint 10.12.0 +
typescript-eslint 8.71.0 + eslint-plugin-react-hooks 7.1.1 + eslint-plugin-react-refresh 0.5.7.

## Research reports

- `plans/reports/researcher-261005-1146-canvas-rendering-library-comparison.md`
- `plans/reports/researcher-261005-1157-ui-framework-state-tooling-stack.md`
