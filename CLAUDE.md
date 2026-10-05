# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Camera Layout Tool: browser-only floor-plan camera planner (Vite + React 19 + TypeScript 5.9 +
Konva + zustand + Tailwind 4 + Zod). No backend, no runtime network calls. See `./README.md`
and `./docs/tech-stack.md`.

Commands: `npm run dev` | `npm run typecheck` | `npm run lint` | `npm test` (Vitest) |
`npm run build`. Run typecheck + test after every code change.

Layout: `src/catalog` (schema, loader, brand JSON data), `src/domain` (pure logic),
`src/canvas` (Konva), `src/panels` (UI), `src/export` (PNG/CSV), `src/file-io`, `src/state`.

Project rules:
- `src/domain/**` must not import React, Konva (enforced by `no-react-konva-imports.test.ts`)
  or `src/catalog`.
- Positions are image px; rotation is degrees, 0 = +x, clockwise. `planPxPerMeter` (scale) and
  DORI px/m are different things - never mix them.
- Catalog optical specs (resolution, lens, HFOV, illumination, DORI) come only from the official
  manufacturer datasheet, copied as printed - never from memory, resellers or calculation.
  `priceVn` is the one exception: a Vietnamese reseller's displayed VND price, or `null`. Never
  invent or currency-convert a price. Record every source in `./docs/camera-catalog-sources.md`.
- Vertical FOV (VFOV) fields (`vfovDeg`, `vfovWideDeg`, `vfovTeleDeg`) are optional: stored only
  when the datasheet prints a vertical angle, copied as printed. The runtime computes a fallback
  from HFOV and sensor aspect ratio and never writes it to the catalog JSON.
- Camera mounting (`mountHeightM` + `tiltDeg`, tilt = degrees down from horizontal) is optional
  and both-or-neither. Unset must draw and save exactly like the flat cone. Floor-coverage math
  lives in `src/domain/mounted-camera-ground-coverage-calculator.ts` (metres only; slant model,
  centre-line arcs, fisheye HFOV >= 180 ignores tilt) - keep it out of components.
- Project files: `PROJECT_SCHEMA_VERSION` is 3; the reader accepts 1, 2 and 3, the writer emits 3.
- Walls are single segments in image px (`opaque` blocks, `glass` never does). Occlusion is a
  full-disc visibility polygon in unrotated image axes
  (`src/domain/wall-occlusion-visibility-polygon.ts`), applied as a Konva `clipFunc` on the
  cone's outer, unrotated Group - so rotation / HFOV changes never recompute it, and no opaque
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