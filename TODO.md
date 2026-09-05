# Mathfinder TODO

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
- [~] Add apps/web, apps/mobile, packages/shared, services/api — apps/web and packages/rules-data/rules-engine live; mobile/shared/api still pending
- [~] Set up linting, formatting, CI, and pre-commit hooks — ESLint + Prettier + GitHub Actions CI added; pre-commit hooks still pending
- [~] Pick + provision backend (DB, realtime, auth) — Supabase selected; CLI config, initial gameplay migration/RLS contract, and optional frontend client are committed; Docker-backed execution, generated types, managed project provisioning, and frontend hosting remain (see `BACKEND_PLAN.md`)

## Phase 1 — Rules Data Foundation

- [~] Define canonical rules-data schema/package for core entities (sources, packs, races, classes, class features, feats, skills, spells) — starter TS schema + validation + index/registry done; JSON serialization/items/archetypes still pending
- [~] Build/ingest 1st-party (Core, APG, ACG, ARG, UM, UC, etc.) dataset under proper licensing (OGL/PRD) — local canonical content is seedable into SQLite and AoN ingestion exists; exhaustive book coverage and source-by-source audit remain pending
- [ ] Ingest **Savage Company (SHM Publishing)** content (cross-check d20pfsrd.com against original manuscript as source of truth)
- [~] Add `source` tag + provenance fields to every entity (enables content-pack toggles) — rules-data sources/packs scaffolded; entity-by-entity provenance expansion still pending
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
- [~] Spellcasting scaffold: caster stats + save DCs + spells/day + bonus slots + prepared/known split + editable web selection UI + spell library/learnable pools + engine-backed diagnostics/warnings + capacity-aware quick-picks/fill-from-library + selection state + count/class/level/library validation + slot expenditure tracking + web runtime cast controls + ability-score gating/diagnostics + manual extra-slot infrastructure + sample cleric domain slots/selections + sample wizard specialist school slots + restricted domain/specialist-slot enforcement + content-db-backed 3k+ runtime spell catalog + support/provenance-aware spell browser/runtime UI done; deeper spell-effect automation breadth is still incremental
- [ ] Maneuver-specific CMB mods (trip/grapple/etc.)
- [x] Carrying capacity / encumbrance auto-from-Str
- [x] Character build/level-up state machine (replayable build steps; `buildCharacter`/`levelUp`/`levelDown`)
- [x] Class progressions: BAB (full/3-4/half) + good/poor saves, multiclass-aware
- [~] Build validation: skill-rank caps, ability-increase placement, unknown class, skill-point budget, equipment/container legality, spell selection diagnostics, and archetype legality/conflict checks are live; prestige-class validation is still pending
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
- [~] Add data-driven dynamic class resource pools to the derived sheet and runtime controls — serializable base/ability/class-level scaling, persisted usage, automatic grant/removal, and Infantryman grit are live; add ki, panache, arcane pool, and further class/archetype/feat pool definitions incrementally
- [x] Activated ability runtime rules: scaling values by BAB (Power Attack, Combat Expertise, Deadly Aim)
- [x] Conditional requirement / illegal-state suppression scaffold (Fast Movement blocked by armor/load)
- [x] Suppression reasons surfaced in the sheet (e.g. Fast Movement suppressed: medium armor)
- [x] Fatigue state + Rage legality suppression
- [~] Broaden conditional legality — serializable activatable armor/load gates and Infantryman's Dodge enforcement are live; expand to additional class features, archetypes, feats, and conditions
- [x] Equipment/inventory engine: item quantities, costs, auto weight, equipped flags, armor metadata, slots, containers, coin/ammo/component tracking, purchase validation, and sheet itemization are all live
- [~] Prerequisite validation for prestige classes, archetypes — archetype legality/conflict validation is live; prestige-class prerequisites still pending
- [x] Parameterized feats (Weapon Focus weapon choice, Skill Focus skill choice)
- [x] Complete parameterized-feat picker and mechanical coverage for Weapon Focus, Skill Focus, Spell Focus, and Greater Spell Focus — runtime scraped feat overrides retain parameter semantics; weapon choices affect only matching attacks, school choices affect only matching spell save DCs, and Greater Spell Focus requires the same school
- [x] Add a campaign house-rule toggle that disables alignment restrictions and alignment-based validation across character creation, level-up, build validation, and persisted campaign rules
- [x] Complete firearm campaign economics — Guns Everywhere uses reversible canonical 10% pricing; Commonplace Guns uses 25% for early firearms and firearm ammunition while advanced firearms retain canonical prices
- [x] Add a campaign house-rule toggle to ignore encumbrance — carried weight, thresholds, and actual load remain visible while the effective load is light for penalties and feature restrictions

## Phase 3 — Character Builder UX

- [x] First UI: Vite + React web app (apps/web) wired to the live engine
- [x] Real-time sheet view (live recompute on any change)
- [x] Interactive buff/aura toggles -> auto-apply to sheet (proves the multiplayer mechanism)
- [x] Web persistence: current build autosave + saved character slots
- [x] Homepage/dashboard foundation: routed landing page, migrated first-class local character records, character cards, quick actions, deep links, character-scoped runtime persistence, clean new-character builds, rename, and confirmed deletion
- [~] Campaign homepage flows — local campaign creation, many-to-many character assignment, cards, overview routes, and honest join state are live; shared Supabase auth/invitations remain
- [x] Click-to-expand stat breakdowns (the 'why' UX)
- [x] Level up / undo buttons backed by levelUp/levelDown
- [x] Interactive level-up modal: class, HP, skill ranks, feat, ability increase (planLevelUp + validation)
- [x] Inline validation surfacing
- [~] Guided build wizard (race → class → abilities → skills → feats → gear) — homepage character creation now opens a dedicated level-1 decision modal for ancestry, class, abilities, skills, feats, favored-class bonus, and live preview; gear and deeper guided branches remain
- [x] Build planner page for future levels / preselected advancement choices
- [~] Editable core build fields in UI are substantial (name, base abilities, carried weight, sample race presets, race choice selections, class archetypes, per-level class/HP/favored-class/ASI, weapons, full inventory/equipment editing with slots/containers/coins/ammo/components/purchase flows, improved equipment/armor cards with running totals, per-level feats, compact/collapsible per-level skill rank builder, and spell library/selection management); broader compendium-backed content editing is still incremental
- [ ] Port presentational components to React Native for the phone build
- [~] Smart defaults + recommendations — planner/level-up suggestions use current abilities, projected BAB/saves, feats, weapons, shields, classes, archetypes, and spellcasting; recommendation quality still needs substantial tuning, richer feat-chain/party-role awareness, and real-character playtesting

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

- [x] Parameterized feats (Weapon Focus weapon choice, Skill Focus skill choice)
- [x] Prestige-class prerequisite validation
- [~] Guided build wizard / smarter character-aware recommendation tuning
- [~] Complete ancestry-specific favored-class bonuses — 731 AoN options across 49 scraped races are ingested with source URLs and available as manual selections; automate common effect families and ingest owner-authored Savage Company FCBs from the manuscript
- [~] Shared compendium/runtime normalization work from `PLAN.md` — catalog indexes are standardized and cached, the generic picker uses shared search, and runtime mutations are behind shared reducers plus focused web helpers; tracker definitions and persistence versioning remain
- [ ] Savage Company content ingestion breadth
- [x] Campaign house-rule controls — Commonplace Guns and Guns Everywhere pricing, ignore alignment restrictions, and ignore encumbrance are live
- [x] Complete selection-bearing feat UX/mechanics for Weapon Focus and Spell Focus; retain the generic parameter model for future selection-bearing feats

## Ingestion Research

- [x] Review Luke Parke's 2023 “Scraping Archives of Nethys for fun and profit” article and repository — it bulk-downloads PF2e records from AoN's Elasticsearch `aon` index by category, then writes raw, parsed `_source`, and per-record JSON; useful as evidence that discovery/fetch/normalization should remain separate
- [x] Spike AoN's Elasticsearch service — the anonymous `aon` index contains 45,405 structured PF2e records, but PF1 URL shapes and PF1-only CMB/CMD terminology return zero results; retain the cached PF1 HTML pipeline rather than importing the wrong edition very efficiently

## Open Questions / Risks

- [ ] Licensing: confirm OGL/PRD coverage for ALL 1st-party content (Savage Company is owner-authored, no barrier)
- [ ] Ingestion order: which books first so we have a usable slice before the full set lands?
- [ ] Modifier stacking edge cases (the eternal Pathfinder boss fight)
