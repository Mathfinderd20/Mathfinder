# Mathfinder

An interactive smart character sheet for **Pathfinder 1st Edition** (plus **Savage
Company** by SHM Publishing) — web and mobile.

Build, level, and track characters with minimal, user-friendly input. The app
understands 1st-party content and does the bookkeeping for you. Players connect
into groups so the DM can monitor key stats, and auras / group buffs apply
directly to player sheets in real time.

## Status

Track new work in [GitHub Issues](https://github.com/Mathfinderd20/Mathfinder/issues).
See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for issue and pull request conventions.
Use [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the GitHub, Supabase, Docker, rollback,
and stale-browser-cache release procedure.

Design docs and existing backlog material:

- [`PLAN.md`](./PLAN.md) — architecture, tech stack, rules-engine design, roadmap
- [`TODO.md`](./TODO.md) — legacy backlog awaiting issue migration; add new work to GitHub
- [`BACKEND_ISSUES.md`](./BACKEND_ISSUES.md) — legacy backend log awaiting issue migration
- [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md) — canonical content, local DB workflow, runtime export contract

## Content workflow

The web app runtime content is loaded from:

- `apps/web/public/usable-content.json`

Useful commands:

- `npm run content:bootstrap` — init local content DB, seed from canonical rules-data, export runtime asset, verify it
- `npm run content:refresh:web` — export current local DB state into the committed web runtime asset
- `npm run content:verify:web` — verify the runtime asset shape without touching the DB

CI also enforces the content contract:

- the committed runtime asset must be structurally valid
- content-affecting source/export changes must include a refreshed `apps/web/public/usable-content.json`

See [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md) for the real source-of-truth rules and commit policy.

## Shared backend workflow

Supabase configuration and migrations live under `supabase/`. Supabase is a
required application dependency: the web app displays a blocking server error
when configuration is missing, startup cannot connect, or synchronization
fails.

The app requires Google or email-link sign-in through Supabase. Characters,
campaigns, assignments, and solo runtime state are cached per account for
read-only outage access and synchronized when connected. See
[authentication setup and recovery](./AUTHENTICATION.md). Set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in
`apps/web/.env.local`; local defaults are documented in `.env.example`.

Useful commands:

- `npm run supabase:start` — start the Docker-backed local Supabase stack
- `npm run supabase:reset` — recreate the local database from committed migrations
- `npm run supabase:lint` — run database lint against the local stack
- `npm run supabase:verify` — run the static schema/RLS contract without Docker
- `npm run supabase:types` — regenerate frontend database types from the local schema

Public frontend configuration belongs in `apps/web/.env.local`, using `apps/web/.env.example` as the template. Never place a service-role key in a `VITE_*` variable. See [`BACKEND_PLAN.md`](./BACKEND_PLAN.md) for architecture and rollout details.

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
