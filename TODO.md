#  Path-Builder TODO

Living checklist. Check things off as we go. Newest insights bubble up into the plan.

## Decisions Locked
- [x] Tech stack: **TypeScript + React Native / RN-Web** (shared web + phone, shared rules engine)
- [x] Content scope for v1: **All 1st-party** (Core, APG, ACG, ARG, UM, UC, etc.) — big lift, ingest incrementally

## Phase 0 — Project Scaffolding
- [ ] Lock dependency versions for the chosen stack
- [ ] Init monorepo (apps/web, apps/mobile, packages/rules-engine, packages/shared, services/api)
- [ ] Set up linting, formatting, CI, and pre-commit hooks
- [ ] Pick + provision backend (DB, realtime, auth)

## Phase 1 — Rules Data Foundation
- [ ] Define canonical JSON schema for all game entities (races, classes, feats, spells, items, etc.)
- [ ] Build/ingest 1st-party (Core, APG, ACG, ARG, UM, UC, etc.) dataset under proper licensing (OGL/PRD)
- [ ] Validate dataset against schema (CI gate)
- [ ] Versioning strategy for rules data (so sheets don't break on update)

## Phase 2 — Rules Engine (the brain)
- [ ] Stat derivation pipeline (abilities → mods → derived stats)
- [ ] Modifier stacking + typed bonus rules (the hard part!)
- [ ] Prerequisite validation (feats, prestige classes, archetypes)
- [ ] Character build/level-up state machine
- [ ] Deterministic recompute given (build choices + active effects)

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
- [ ] Licensing: confirm OGL/PRD coverage for ALL 1st-party content (bigger now that scope = everything)
- [ ] Ingestion order: which books first so we have a usable slice before the full set lands?
- [ ] Modifier stacking edge cases (the eternal Pathfinder boss fight)
