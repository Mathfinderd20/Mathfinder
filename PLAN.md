# Mathfinder Plan

## Active feature plans

- [`HOMEPAGE_PLAN.md`](./HOMEPAGE_PLAN.md) — user dashboard, character navigation, campaign entry points, persistence migration, and phased multiplayer boundary
- [`BACKEND_PLAN.md`](./BACKEND_PLAN.md) — Supabase architecture, authentication, data model, permissions, realtime sync, and delivery phases

## Unified compendium + runtime systems layer

### Goal

Move the app toward a data-driven architecture where content catalogs and runtime tracking stop being feature-specific one-offs.

### Current foundation in repo

- Shared compendium primitives in `packages/rules-engine/src/compendium.ts`
- Cached, collision-aware compendium indexes across feats, spells, weapons, class features, and magic items
- Shared runtime primitives in `packages/rules-engine/src/runtime.ts`
- Web runtime persistence migrated to the generic runtime snapshot shape
- Runtime mutations use shared reducer actions, including atomic batches for
  multi-field domain transitions
- Health and combat runtime orchestration is extracted from `App.tsx` into
  focused, tested hooks and mutation helpers
- Existing content registries beginning to reuse shared compendium indexing helpers

### Phased next work

#### 1. Compendium normalization

- Add shared base metadata across feats, spells, weapons, class features, and items
- Introduce explicit entity kinds and automation/support metadata where relevant
- Replace ad hoc `Record<string, T>` registries with shared index builders everywhere
- Add generic search/filter helpers for UI pickers

#### 2. Runtime normalization

- Move runtime state mutations behind shared helpers/reducers
- Model resources, ledgers, histories, and toggles as tracker definitions instead of bespoke component state
- Unify combat/event logging with typed subjects and actions
- Add migration helpers for persisted runtime snapshots

#### 3. UI generation

- Drive pickers/forms from compendium metadata instead of hand-maintained option plumbing
- Surface automation/manual coverage consistently in editor + sheet views
- Reuse generic search result rendering for spells/items/weapons/features

#### 4. Validation + explanation

- Add one support-status/reporting path for fully modeled vs partial vs manual content
- Attach provenance and validation explanations to compendium entities and runtime actions
- Expand tests around persistence migrations and registry guarantees

### Immediate best next slice

1. Build a generic searchable picker component using shared compendium search
2. Introduce tracker definitions for resources, ledgers, histories, and toggles
3. Add persisted runtime migration versioning before shared backend sync

Because if every subsystem invents its own registry, tracker, and search behavior, we are just speedrunning elegant inconsistency.
