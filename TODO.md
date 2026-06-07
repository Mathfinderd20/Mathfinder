#  Path-Builder TODO

Living checklist. Check things off as we go. Newest insights bubble up into the plan.

## Decisions Locked
- [x] Tech stack: **TypeScript + React Native / RN-Web** (shared web + phone, shared rules engine)
- [x] Content scope for v1: **All 1st-party** (Core, APG, ACG, ARG, UM, UC, etc.) **+ Savage Company (SHM Publishing)** — big lift, ingest incrementally
- [x] Savage Company: authored by project owner (no third-party licensing issue); some content on d20pfsrd.com

## Phase 0 — Project Scaffolding
- [x] Install toolchain (Node LTS 24.16, npm 11.13, Git) via winget
- [x] Init monorepo with npm workspaces (packages/rules-engine live)
- [x] tsconfig.base + per-package TS config (strict, noUncheckedIndexedAccess)
- [ ] Lock remaining dependency versions as packages are added
- [ ] Add apps/web, apps/mobile, packages/shared, services/api
- [ ] Set up linting, formatting, CI, and pre-commit hooks
- [ ] Pick + provision backend (DB, realtime, auth)

## Phase 1 — Rules Data Foundation
- [ ] Define canonical JSON schema for all game entities (races, classes, feats, spells, items, etc.)
- [ ] Build/ingest 1st-party (Core, APG, ACG, ARG, UM, UC, etc.) dataset under proper licensing (OGL/PRD)
- [ ] Ingest **Savage Company (SHM Publishing)** content (cross-check d20pfsrd.com against original manuscript as source of truth)
- [ ] Add `source` tag + provenance fields to every entity (enables content-pack toggles)
- [ ] Validate dataset against schema (CI gate)
- [ ] Versioning strategy for rules data (so sheets don't break on update)

## Phase 2 — Rules Engine (the brain)
- [x] Modifier stacking + typed bonus rules (the hard part!) — `resolveModifiers`
- [x] Stat derivation pipeline (abilities → mods → AC/saves/init/CMB/CMD/attack)
- [x] Deterministic `computeSheet(input)` with per-stat breakdowns (the 'why' UX)
- [x] Skills derivation (ranks + class skill + ability + misc - armor check penalty; trained-only)
- [x] HP (per-die min-1 Con rule + flat bonuses) and Speed derivation
- [x] Sheet formatter (`renderSheet` / `explainStat`) + runnable demo (`npm run demo`)
- [x] Golden tests pinned to hand-computed PF1e math (28/28 green)
- [ ] Spell save DCs + caster stats
- [ ] Maneuver-specific CMB mods (trip/grapple/etc.)
- [ ] Carrying capacity / encumbrance auto-from-Str
- [ ] Prerequisite validation (feats, prestige classes, archetypes)
- [ ] Character build/level-up state machine (replayable build steps)

## Phase 3 — Character Builder UX
- [ ] Guided build wizard (race → class → abilities → skills → feats → gear)
- [ ] Level-up flow with minimal input
- [ ] Smart defaults + recommendations
- [ ] Real-time sheet view (web + mobile shared components)

## Phase 4 — Multiplayer / Group Layer
- [ ] Group/party model + invites
- [ ] DM dashboard (party overview, key stats, perception/saves at a glance)
- [ ] Realtime sync of sheet state
- [ ] Aura/group-buff broadcast → auto-apply to member sheets
- [ ] Permission model (what DM can see/do vs players)

## Phase 5 — Polish & Launch
- [ ] Offline support / local-first sync
- [ ] Export/print (PDF) character sheets
- [ ] Accessibility pass
- [ ] Beta test with a real Pathfinder group
- [ ] App store + web deploy

## Open Questions / Risks
- [ ] Licensing: confirm OGL/PRD coverage for ALL 1st-party content (Savage Company is owner-authored, no barrier)
- [ ] Ingestion order: which books first so we have a usable slice before the full set lands?
- [ ] Modifier stacking edge cases (the eternal Pathfinder boss fight)
