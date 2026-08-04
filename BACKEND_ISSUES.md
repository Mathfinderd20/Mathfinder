# Backend Issue Tracking Log

Use this file to track **backend/API/service-layer issues** before `services/api` is fully scaffolded.

This is intentionally lightweight:

- contributors can add issues without needing GitHub issue setup changes
- backend work stays visible while the backend stack is still being chosen
- problems, decisions, blockers, and follow-up tasks live in one boring, searchable place

## Scope

Track items related to:

- backend/API architecture
- auth
- database
- realtime sync
- multiplayer/group state
- permissions
- deployment/ops
- backend-adjacent integration gaps between web and future API

Do **not** use this file for:

- pure rules-engine math issues
- UI-only polish
- content ingestion chores unless they are blocked by backend concerns

## Contributor Rules

When adding an issue:

1. Add a new row to the table below.
2. Keep titles short and specific.
3. Include a real owner if you’re taking it.
4. Update `status` instead of duplicating the same issue three times like a chaos goblin.
5. If the issue turns into a major architectural decision, also summarize it in `PLAN.md` / `TODO.md`.

### Status values

- `open`
- `investigating`
- `blocked`
- `in-progress`
- `resolved`
- `wont-fix`

### Priority values

- `P0` — project-blocking / dangerous
- `P1` — important core backend work
- `P2` — useful but not urgent
- `P3` — cleanup / polish / nice-to-have

## Backend Issue Log

| ID     | Title                                                                              | Area         | Priority | Status      | Owner             | Opened     | Blocked By     | Notes / Next Step                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------- | ------------ | -------- | ----------- | ----------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-001 | Pick backend platform and hosting path                                             | architecture | P0       | in-progress | code-puppy-7937d3 | 2026-06-17 | —              | Supabase selected for PostgreSQL, Auth, RLS, Realtime, and Edge Functions; frontend host and environment provisioning remain. See `BACKEND_PLAN.md`.                                                                           |
| BE-002 | Define initial data model for users, characters, parties, memberships, and effects | data-model   | P1       | open        | unassigned        | 2026-06-17 | BE-001         | Draft relational schema + JSON boundaries for multiplayer/state sync. Note: content-compendium SQLite schema + ingestion tables now live in `packages/content-db`, but gameplay/user/group relational schema is still pending. |
| BE-003 | Choose auth provider and account model                                             | auth         | P1       | resolved    | unassigned        | 2026-06-17 | BE-001         | Supabase Auth selected with Google OAuth primary, email magic-link fallback, and local guest mode. Player-owned character permissions are defined in `BACKEND_PLAN.md`.                                                        |
| BE-004 | Define realtime sync strategy for sheets and group buffs                           | realtime     | P1       | open        | unassigned        | 2026-06-17 | BE-001, BE-002 | Decide event model, optimistic updates, authority boundaries, and reconnect behavior.                                                                                                                                          |
| BE-005 | Define permission rules for DM vs player capabilities                              | permissions  | P1       | open        | unassigned        | 2026-06-17 | BE-002, BE-003 | Clarify what a DM can view/edit/broadcast and what remains player-controlled.                                                                                                                                                  |
| BE-006 | Scaffold `services/api` package structure                                          | scaffolding  | P2       | open        | unassigned        | 2026-06-17 | BE-001         | Create the actual hosted/backend API workspace once the platform decision stops being a shrug. Separate local ingestion workspace now exists as `packages/content-db`.                                                         |

## Scratchpad / Discovery Notes

Use this section for short backend findings before they deserve a formal issue row.

- None yet.
