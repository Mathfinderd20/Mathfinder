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
- [x] Weapon attack/damage lines (attack, damage dice+bonus, crit)
- [x] Sheet formatter (`renderSheet` / `explainStat`) + runnable demo (`npm run demo`)
- [x] Golden tests pinned to hand-computed PF1e math (28/28 green)
- [~] Spellcasting scaffold: caster stats + save DCs + spells/day + bonus slots + prepared/known split + selection state + count/class/level validation + slot expenditure tracking + web runtime cast controls + local persistence started; full content DB and extra-slot sources pending
- [ ] Maneuver-specific CMB mods (trip/grapple/etc.)
- [x] Carrying capacity / encumbrance auto-from-Str
- [x] Character build/level-up state machine (replayable build steps; `buildCharacter`/`levelUp`/`levelDown`)
- [x] Class progressions: BAB (full/3-4/half) + good/poor saves, multiclass-aware
- [x] Build validation: skill-rank caps, ability-increase placement, unknown class, skill-point budget
- [x] Build -> computeSheet golden tests incl. level-up (40/40 green)
- [x] Feat content model (FeatDefinition: prereqs + effects + pack tag) with core feat set
- [x] Feat prerequisite checking (BAB/ability/feat/level) with reasons
- [x] Feat effects auto-apply via registry (no more hand-written feat modifiers)
- [x] Prereq-aware feat picker in the level-up modal (locks feats you don't qualify for)
- [x] Savage Company feat pack scaffold (empty, ready to populate from manuscript)
- [x] Class-feature content model + progression grants (Barbarian/Fighter/Rogue L1 scaffold)
- [x] Passive class-feature effects auto-apply from the registry (e.g. Fast Movement)
- [x] Activated class abilities scaffolded from class-feature content (Rage toggle derived from granted feature)
- [x] Shared activatable-effect model spanning class features and feats
- [x] Generic collector for toggleable abilities from granted features / taken feats
- [x] Runtime selection resolver for activatables
- [x] Exclusivity groups for modes/stances (e.g. attack-mode) + UI radios
- [x] Activated ability runtime rules: rounds/day/resource tracking scaffold (Rage rounds/day)
- [x] Activated ability runtime rules: scaling values by BAB (Power Attack, Combat Expertise, Deadly Aim)
- [x] Conditional requirement / illegal-state suppression scaffold (Fast Movement blocked by armor/load)
- [x] Suppression reasons surfaced in the sheet (e.g. Fast Movement suppressed: medium armor)
- [x] Fatigue state + Rage legality suppression
- [ ] Broaden conditional legality (more armor/load restrictions, class-feature gates, etc.)
- [~] Equipment/inventory engine: item quantities, costs, auto weight done; slots + mundane/magic item scaffolds pending
- [ ] Prerequisite validation for prestige classes, archetypes
- [ ] Parameterized feats (Weapon Focus weapon choice, Skill Focus skill choice)

## Phase 3 — Character Builder UX
- [x] First UI: Vite + React web app (apps/web) wired to the live engine
- [x] Real-time sheet view (live recompute on any change)
- [x] Interactive buff/aura toggles -> auto-apply to sheet (proves the multiplayer mechanism)
- [x] Web persistence: current build autosave + saved character slots
- [x] Click-to-expand stat breakdowns (the 'why' UX)
- [x] Level up / undo buttons backed by levelUp/levelDown
- [x] Interactive level-up modal: class, HP, skill ranks, feat, ability increase (planLevelUp + validation)
- [x] Inline validation surfacing
- [ ] Guided build wizard (race → class → abilities → skills → feats → gear)
- [ ] Build planner page for future levels / preselected advancement choices
- [~] Editable core build fields in UI started (name, base abilities, carried weight); skill ranks/race/class/gear editing still pending
- [ ] Port presentational components to React Native for the phone build
- [ ] Smart defaults + recommendations

## Phase 4 — Multiplayer / Group Layer
- [ ] Group/party model + invites
- [ ] DM dashboard (party overview, key stats, perception/saves at a glance)
- [ ] Realtime sync of sheet state
- [ ] Aura/group-buff broadcast → auto-apply to member sheets
- [ ] Permission model (what DM can see/do vs players)

## Phase 5 — Polish & Launch
- [~] Offline/local persistence started in web (build + runtime localStorage); broader local-first sync pending
- [ ] Export/print (PDF) character sheets
- [ ] Accessibility pass
- [ ] Beta test with a real Pathfinder group
- [ ] App store + web deploy

## Next Bulldoze Order
- [ ] Finish inventory depth: equipment slots, containers, coins/ammo/components, purchase validation
- [ ] Spellcasting phase 1: caster ability, CL, concentration, save DCs, slots/day tables
- [ ] Build planning phase 1: future feat/ability/class picks without applying yet

## Open Questions / Risks
- [ ] Licensing: confirm OGL/PRD coverage for ALL 1st-party content (Savage Company is owner-authored, no barrier)
- [ ] Ingestion order: which books first so we have a usable slice before the full set lands?
- [ ] Modifier stacking edge cases (the eternal Pathfinder boss fight)
