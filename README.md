# Mathfinder

An interactive smart character sheet for **Pathfinder 1st Edition** (plus **Savage
Company** by SHM Publishing) — web and mobile.

Build, level, and track characters with minimal, user-friendly input. The app
understands 1st-party content and does the bookkeeping for you. Players connect
into groups so the DM can monitor key stats, and auras / group buffs apply
directly to player sheets in real time.

## Status

Early planning. See:

- [`PLAN.md`](./PLAN.md) — architecture, tech stack, rules-engine design, roadmap
- [`TODO.md`](./TODO.md) — living checklist of steps
- [`BACKEND_ISSUES.md`](./BACKEND_ISSUES.md) — contributor-facing backend/API issue tracking log
- [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md) — canonical content, local DB workflow, runtime export contract

## Content workflow

The web app runtime content is loaded from:

- `apps/web/public/usable-content.json`

Useful commands:

- `npm run content:bootstrap` — init local content DB, seed from canonical rules-data, export runtime asset, verify it
- `npm run content:refresh:web` — export current local DB state into the committed web runtime asset
- `npm run content:verify:web` — verify the runtime asset shape without touching the DB

See [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md) for the real source-of-truth rules and commit policy.

## Decisions Locked

- **Stack:** TypeScript + React Native / React Native Web (shared web + phone, shared rules engine)
- **Content scope (v1):** All 1st-party content (Core, APG, ACG, ARG, UM, UC, etc.) **plus
  Savage Company (SHM Publishing)**, ingested incrementally. Every entity is tagged with a
  `source` so content packs can be toggled and attributed.

## Licensing Note

Pathfinder 1e mechanics are covered under the OGL. All bundled Paizo content must respect
OGL/PRD attribution and avoid Product Identity. **Savage Company is authored by the project
owner (SHM Publishing)** and carries no third-party licensing barrier. A legal review of the
v1 Paizo content list is a prerequisite to shipping. See PLAN.md section 7.
