# Path-Builder

An interactive smart character sheet for **Pathfinder 1st Edition** — web and mobile.

Build, level, and track characters with minimal, user-friendly input. The app
understands 1st-party content and does the bookkeeping for you. Players connect
into groups so the DM can monitor key stats, and auras / group buffs apply
directly to player sheets in real time.

## Status

Early planning. See:

- [`PLAN.md`](./PLAN.md) — architecture, tech stack, rules-engine design, roadmap
- [`TODO.md`](./TODO.md) — living checklist of steps

## Decisions Locked

- **Stack:** TypeScript + React Native / React Native Web (shared web + phone, shared rules engine)
- **Content scope (v1):** All 1st-party content (Core, APG, ACG, ARG, UM, UC, etc.), ingested incrementally

## Licensing Note

Pathfinder 1e mechanics are covered under the OGL. All bundled content must respect
OGL/PRD attribution and avoid Product Identity. A legal review of the v1 content list
is a prerequisite to shipping. See PLAN.md section 7.
