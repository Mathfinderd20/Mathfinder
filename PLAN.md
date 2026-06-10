# Mathfinder — Interactive Smart Character Sheet for Pathfinder 1e

> A cross-platform (web + mobile) app that understands all 1st-party Pathfinder 1e
> content **plus Savage Company (SHM Publishing)**, lets users build/level/track
> characters with minimal friction, and connects players into groups so the DM can
> monitor the party and push auras/buffs directly onto player sheets in real time.

---

## 1. Goals & Non-Goals

### Goals
- **Understands the rules**: encodes 1st-party content (races, classes, archetypes,
  feats, skills, spells, items, conditions) **and Savage Company (SHM Publishing)**
  content, plus the math that binds them all.
- **Multi-source by design**: every entity carries a `source` tag (e.g. `core`, `apg`,
  `savage-company`) so content packs can be toggled, filtered, and attributed cleanly.
- **Smart, minimal input**: the app does the bookkeeping. User makes *decisions*,
  not arithmetic. Pick a race → it applies the modifiers. Level up → it walks you
  through only the choices that matter.
- **Real-time sheet**: every derived stat recomputes instantly as inputs/effects change.
- **Group play**: DM sees the party; auras/buffs from one source apply to many sheets.
- **Cross-platform**: one codebase footprint for web and phone where possible.

### Non-Goals (v1)
- 3rd-party / homebrew content (design for it, don't ship it day one).
- Full VTT (virtual tabletop maps/tokens). We track sheets, not battlemaps.
- Rules *adjudication* of every edge case — DM is still the final boss.

---

## 2. Tech Stack — LOCKED

**Decision: TypeScript + React Native / React Native Web.** One shared codebase
for web and phone, one shared rules engine. The big win is **share the rules
engine + UI between web and mobile**.

| Layer            | Choice                                   | Why |
|------------------|------------------------------------------|-----|
| Language         | **TypeScript** everywhere                | One language, shared types from data → UI |
| Mobile + Web UI  | **React Native + React Native Web** (or Expo) | Truly shared components across phone & browser |
| Rules engine     | Plain TS package (`packages/rules-engine`) | Pure functions, no framework lock-in, unit-testable |
| State            | **Zustand** or Redux Toolkit             | Predictable, serializable character state |
| Backend API      | **Node + tRPC** (or NestJS)              | End-to-end typesafe calls, no schema drift |
| Database         | **PostgreSQL** (Supabase/Neon)           | Relational party/user data + JSONB for sheets |
| Realtime         | **Supabase Realtime** or a WS layer      | Live party sync + buff broadcast |
| Auth             | Supabase Auth / Clerk                    | Don't roll your own crypto, ever |
| Rules data       | **Versioned JSON** in `packages/rules-data` | Static, cacheable, diffable |

> Alt stack if the team prefers Flutter: keep the **rules engine language-agnostic**
> by defining data as JSON + a documented modifier spec, so it can be re-implemented.
> But TS-everywhere is the lowest-friction path here.

---

## 3. Architecture Overview

```
                ┌─────────────────────────────────────────────┐
                │              Clients (shared UI)             │
                │   apps/web (RN-Web)   apps/mobile (RN/Expo)  │
                └───────────────┬─────────────────────────────┘
                                │  typesafe API (tRPC) + Realtime WS
                ┌───────────────┴─────────────────────────────┐
                │                services/api                  │
                │   auth · party mgmt · sync · buff broadcast  │
                └───────────────┬─────────────────────────────┘
                                │
                      ┌─────────┴─────────┐
                      │   PostgreSQL DB    │   users, characters(JSONB),
                      │                    │   parties, memberships, effects
                      └────────────────────┘

   packages/rules-engine  ←─ pure TS, runs on client AND server
   packages/rules-data    ←─ versioned 1st-party content as JSON
   packages/shared        ←─ types, schemas (zod), validators
```

**Key principle: the rules engine is a pure, deterministic function.**

```
computeSheet(buildChoices, activeEffects, rulesData) → DerivedCharacterSheet
```

Same function runs on device (instant UI) and on server (authoritative checks,
DM views, conflict resolution). No "the math is different on mobile" bugs. Ever.

---

## 4. The Rules Engine (the hard, fun part)

Pathfinder's complexity isn't the content volume — it's the **modifier stacking**.

### 4.1 Data model (entities)
- `Race`, `Class`, `Archetype`, `ClassFeature`, `Feat`, `Skill`, `Spell`,
  `Item`/`Equipment`, `Condition`, `Trait`, `Deity`, `Domain`, etc.
- Each entity declares **effects** in a structured DSL, not prose:
  ```jsonc
  {
    "id": "feat.weapon-focus",
    "prerequisites": [{ "type": "bab", "min": 1 }, { "type": "proficiency", "weapon": "$choice" }],
    "effects": [{ "target": "attack", "weapon": "$choice", "bonus": 1, "bonusType": "untyped" }]
  }
  ```

### 4.2 Modifier stacking rules (the boss fight)
- Typed bonuses (enhancement, morale, luck, deflection, dodge…) — **same type doesn't stack; take highest**.
- **Dodge** and **untyped** and **circumstance**(usually) DO stack.
- Penalties generally stack.
- Engine implements: collect all modifiers → group by (target, type) → apply
  stacking policy per type → sum.

### 4.3 Derivation pipeline
```
ability scores → ability mods → {
  AC, saves (Fort/Ref/Will), BAB, CMB/CMD,
  skills, initiative, HP, attacks, DCs, speed...
}
```
Recompute is a topological pass: inputs first, derived later, effects layered in.

### 4.4 Build / level-up state machine
- A character = ordered list of **build steps** (LevelChoice records).
- Replaying steps + applying active effects = current sheet.
- This makes level-up, respec, and "undo" trivial, and keeps sheets reproducible
  across rules-data versions (pin the version per character).

### 4.5 Validation
- Prerequisites checked at build time (feats, prestige classes, multiclass rules).
- Surface *why* something is unavailable ("needs BAB +1") rather than just hiding it.

---

## 5. Smart, Minimal-Input UX

- **Guided wizard**: Race → Ability scores (point-buy/roll/array) → Class → Skills →
  Feats → Gear. Only ask what requires a decision; auto-apply everything mechanical.
- **Recommendations**: highlight legal, synergistic choices ("you qualify for Power Attack").
- **Live sheet**: any change ripples through derived stats instantly (engine is fast + local).
- **Inline explanations**: tap a stat → see the breakdown ("AC 18 = 10 +4 armor +2 dex +2 shield").
- **Quick-toggles**: conditions, buffs, rage, fighting defensively — flip a switch,
  watch the numbers update.

---

## 6. Multiplayer / Group Layer

### 6.1 Data
- `Party` ↔ `Membership(user, character, role)` where role ∈ {DM, Player}.
- Characters owned by players; DM gets a **read view** of agreed-upon fields.

### 6.2 DM Dashboard
- Party roster with at-a-glance: AC, touch/flat-footed, saves, Perception, HP, conditions,
  passive senses, key resistances.
- Sortable/filterable for fast initiative & "everyone roll Will" moments.

### 6.3 Realtime sync
- Each sheet change → diff event → broadcast to party channel.
- Local-first: client applies optimistically, server confirms (authoritative recompute).

### 6.4 Auras & Group Buffs (the headline feature)
- An **effect source** (e.g. Bless, Haste, Bardic Performance, Paladin aura) is published
  to the party channel with: `{ effect, range/scope, duration, source }`.
- Targeting modes: whole party, allies-in-range (manual or position-aware later), selected.
- Each affected sheet **layers the effect into `activeEffects`** and recomputes —
  player sees +1 attack/save from Bless appear automatically, with provenance shown.
- Players can see "why" a stat changed and who's responsible (no mystery buffs).
- DM (or buff owner) can end the effect → it cleanly peels off every sheet.

### 6.5 Permissions
- DM: view party, broadcast effects, end effects, see shared fields.
- Player: full control of own sheet, accept/decline incoming effects (configurable),
  choose what's shared with DM.

---

## 7. Data Sourcing & Licensing 

### Paizo 1st-party content
- Pathfinder 1e core mechanics are released under the **OGL**; much of the content is
  on the **PRD/Archives of Nethys (PRD)**. We must:
  - Include OGL notice + Section 15 attribution.
  - Verify each book/entry's open-content status before bundling.
  - Avoid Product Identity (names, art, lore that isn't open).
- Plan: ingest from openly-licensed structured sources; keep a provenance field per entity.
- **Action item**: legal review of the v1 Paizo content list before shipping.

### Savage Company (SHM Publishing) — first-party to US
- **Authored by the project owner (SHM Publishing).** We hold the rights, so there is
  **no third-party licensing barrier** to bundling it.
- Some Savage Company content is published on **d20pfsrd.com** — usable as a structured
  ingestion source (cross-check against the original manuscript as the source of truth).
- Tag every Savage Company entity with `source: "savage-company"` for filtering,
  attribution display, and content-pack toggling.
- Because we own it, we can also encode the *richest* effect data here (full structured
  modifiers) without worrying about open-content boundaries — a great proving ground
  for the effects DSL.

### Provenance model
- Every entity: `{ source, sourcePage?, license }`. Drives attribution UI, content-pack
  toggles, and "where did this rule come from" tooltips.

---

## 8. Phased Roadmap

> **Scope decision: v1 targets ALL 1st-party content + Savage Company (SHM Publishing).**
> That's a large ingestion + validation effort, so we still *build* against a Core slice
> first, then expand the dataset incrementally toward full coverage without changing the
> engine. Savage Company is owned by the project author, so it can be bundled freely and
> is an ideal first content pack to exercise the effects DSL end-to-end.

1. **Foundation** — schema + small data slice (Core first) + engine for abilities/AC/saves.
2. **Build + Level** — full Core class/feat/skill build with validation; single-player.
3. **Content expansion** — APG, UM, UC, ACG, ARG… + **Savage Company** ingest + validate incrementally.
4. **Multiplayer** — parties, DM dashboard, realtime sheet sync.
5. **Auras/Buffs** — effect broadcast + auto-apply + provenance.
6. **Polish** — offline, PDF export, accessibility, beta with a real table.

---

## 9. Testing Strategy

- **Rules engine = unit test goldmine.** Every stacking rule, every derived stat,
  golden-file character fixtures ("Level 7 Paladle should have these exact numbers").
- Property-based tests for stacking (same-type bonuses never double-count).
- Contract tests between client engine and server engine (must agree byte-for-byte).
- E2E: build a character via wizard, level it, apply a buff, verify sheet.

---

## 10. Immediate Next Steps (see TODO.md Phase 0–1)

1. Lock the stack (TS + RN/RN-Web + tRPC + Postgres + Supabase Realtime).
2. Scaffold the monorepo.
3. Define the entity JSON schema (zod) for the *first slice* (race + class + ability + AC + saves).
4. Stand up the rules-engine package with `computeSheet()` + first golden tests.
