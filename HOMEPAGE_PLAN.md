# Homepage Feature Plan

## Product goal

Give users a useful landing page before they enter a character sheet. The home page should answer two questions immediately:

1. **What am I currently playing?** — active campaigns and characters.
2. **What can I do next?** — create a character, start a campaign, or join one.

The first release should feel complete with local data while leaving a clean seam for authentication, API persistence, invitations, and realtime campaign features later.

## Current-state constraints

- `apps/web/src/App.tsx` is the entire sheet/editor experience and has no routing layer.
- The current build, current level, runtime state, and saved build slots use separate `localStorage` keys.
- A saved build slot is a snapshot, not a first-class character record.
- There is no user, campaign, membership, invite, API, or authentication model yet.
- The app loads the large runtime content catalog before rendering anything, even though the homepage does not need it.

We must preserve existing local characters during migration. Quietly eating someone's level-12 wizard would be a bold onboarding strategy.

## Proposed information architecture

### Routes

| Route                           | Purpose                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `/`                             | User homepage/dashboard                                              |
| `/characters/new`               | Start the guided character creation flow                             |
| `/characters/:characterId`      | Open the selected character, defaulting to its sheet                 |
| `/characters/:characterId/:tab` | Open `sheet`, `gear`, or `build` directly                            |
| `/campaigns/new`                | Create a campaign                                                    |
| `/campaigns/join`               | Join using an invitation code or link                                |
| `/campaigns/:campaignId`        | Campaign overview; a later slice can grow this into the GM dashboard |

Use `react-router-dom` rather than hand-rolling history handling. Browser back/forward, deep links, and route parameters are solved problems; we do not need to become amateur cartographers.

### Homepage layout

#### 1. Global header

- Mathfinder brand linking to `/`
- Compact user/profile affordance reserved for future authentication
- Responsive navigation; no duplicate mobile-only feature set

#### 2. Welcome and quick actions

A concise welcome heading followed by three visually distinct actions:

- **Create Character** — primary action
- **Start Campaign** — secondary action
- **Join Campaign** — secondary action

On desktop these appear as a three-card/action row. On narrow screens they stack and remain reachable without horizontal scrolling.

#### 3. My Campaigns

Campaign cards show:

- campaign name
- user's role (`Game Master` or `Player`)
- member/character count when available
- linked character summary
- last activity
- a clear **Open Campaign** action

The empty state explains the value of campaigns and repeats the start/join actions. Do not render dead decorative cards.

#### 4. My Characters

Character cards show:

- character name
- ancestry and class summary
- current level
- associated campaigns, or `No campaigns`
- last edited time
- **Open Sheet** as the primary card action
- **Edit Build** as a secondary action

Cards should be keyboard accessible and must not hide all actions behind hover. The section includes a **Create Character** action and a useful empty state.

## Visual direction

Retain the existing warm, dark tabletop palette (`--bg`, `--panel`, copper accents) so the homepage feels like the same product. Evolve it with:

- a restrained parchment/map texture effect using CSS gradients rather than a heavy image asset
- larger typography and more breathing room than the dense sheet UI
- clear card hierarchy, status chips, and strong focus states
- class/ancestry initials or simple CSS emblems initially; no random fantasy stock-art soup
- responsive breakpoints for phone, tablet, and desktop
- reduced-motion support and WCAG AA color contrast

A low-fidelity desktop composition:

```text
┌ Mathfinder                                      Profile ┐
│ Welcome back                                             │
│ Your campaigns and heroes, ready for the next session.  │
│ [ + Create Character ] [ Start Campaign ] [ Join ]      │
│                                                          │
│ My Campaigns                              [See all]       │
│ ┌ Ironfang Invasion ┐ ┌ Saturday Sandbox ┐              │
│ │ GM · 5 members    │ │ Player · 4 members│              │
│ │ Open Campaign     │ │ Open Campaign     │              │
│ └───────────────────┘ └────────────────────┘              │
│                                                          │
│ My Characters                           [Create new]      │
│ ┌ Brakka · Barbarian 5 ┐ ┌ Elowen · Wizard 3 ┐          │
│ │ Ironfang Invasion    │ │ No campaign        │          │
│ │ [Open Sheet] [Edit]  │ │ [Open Sheet] [Edit]│          │
│ └───────────────────────┘ └─────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

## Domain model

Keep homepage records separate from rules-engine entities. The rules engine should know how a character works, not where its dashboard card lives.

```ts
interface CharacterRecord {
  id: string;
  name: string;
  build: CharacterBuild;
  currentLevel: number;
  createdAt: string;
  updatedAt: string;
}

interface CampaignRecord {
  id: string;
  name: string;
  description?: string;
  role: "gm" | "player";
  memberCount?: number;
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignCharacterAssignment {
  campaignId: string;
  characterId: string;
  assignedAt: string;
}
```

Runtime combat state must be scoped by character ID rather than shared globally. Characters may belong to multiple campaigns, so campaign assignment is a many-to-many relationship represented by explicit `CampaignCharacterAssignment` records rather than duplicated ID arrays that can drift out of sync. Players always retain edit control over their canonical characters; campaign GMs may view assigned characters but do not lock or own them. Campaign membership should eventually come from the backend, but the UI should consume repository methods rather than call `localStorage` directly.

### Repository boundary

Define narrow interfaces such as:

```ts
interface CharacterRepository {
  list(): CharacterRecord[];
  get(id: string): CharacterRecord | undefined;
  create(input: NewCharacterInput): CharacterRecord;
  save(record: CharacterRecord): void;
  remove(id: string): void;
}

interface CampaignRepository {
  list(): CampaignRecord[];
  get(id: string): CampaignRecord | undefined;
  create(input: NewCampaignInput): CampaignRecord;
  join(inviteCode: string): Promise<CampaignRecord>;
}
```

The first adapters can use `localStorage`. Later API adapters can replace them without rewriting homepage components. Components receive records and callbacks; they do not become tiny database administrators.

## Legacy character migration

Add a versioned migration from the existing keys:

- `mathfinder:web-build:v1`
- `mathfinder:web-current-level:v1`
- `mathfinder:web-build-slots:v1`
- `mathfinder:web-runtime:v1`

Migration behavior:

1. Run only when the new character store has not been initialized.
2. Convert the current autosaved build into a `CharacterRecord`.
3. Convert each saved slot into a separate record while preserving its saved timestamp.
4. Generate stable IDs once and store the migrated result atomically.
5. Scope the existing runtime state to the migrated current character.
6. Keep legacy keys during the feature rollout; remove them only in a later, explicit cleanup after migration has proven reliable.
7. Handle malformed records individually so one broken slot does not discard every valid character.

If duplicate snapshots are detected by ID or serialized build equality, prefer the most recently saved copy. Migration logic should be pure and unit tested.

## Campaign behavior and backend boundary

### Local-first deliverable

- Users can create local campaigns and associate local characters.
- Campaign overview routes and empty states are functional.
- Join Campaign presents a real invite-code form with validation and clear error/loading states.

### Backend-dependent deliverable

Actually joining another person's campaign requires shared identity and server state. Do not fake success in local storage. Until an API exists, the join form should clearly state that online invitations are not enabled, or be feature-flagged out of production.

The eventual API needs:

- authenticated user identity
- campaign and membership persistence
- unique, expiring/revocable invite codes
- authorization for GM/player actions
- character ownership and campaign-assignment rules
- realtime activity/member updates as a later enhancement

## Frontend structure

Do not add homepage logic to the already oversized `App.tsx`. Split by responsibility:

```text
apps/web/src/
  app/
    AppRouter.tsx
    AppShell.tsx
  features/home/
    HomePage.tsx
    QuickActions.tsx
    CampaignList.tsx
    CampaignCard.tsx
    CharacterList.tsx
    CharacterCard.tsx
    home.css
  features/characters/
    CharacterWorkspace.tsx
    characterRepository.ts
    characterMigration.ts
    characterTypes.ts
  features/campaigns/
    CampaignPage.tsx
    CreateCampaignPage.tsx
    JoinCampaignPage.tsx
    campaignRepository.ts
    campaignTypes.ts
  components/
    EmptyState.tsx
```

`App.tsx` should become, or be wrapped by, `CharacterWorkspace`; extraction should be mechanical first. Avoid mixing a giant sheet refactor into the visual homepage work.

The homepage should render before runtime compendium content is fetched. Load rules content only for character creation/workspace routes. This improves perceived startup and prevents content-loading failures from blocking campaign/character navigation.

## Implementation status

- [x] Add browser routing and make `/` the default entry point.
- [x] Render the homepage before loading runtime compendium content.
- [x] Add versioned local character records and non-destructive legacy migration.
- [x] Scope runtime persistence by character ID.
- [x] Add character cards, quick actions, empty states, and responsive homepage styling.
- [x] Add character sheet/build deep links and a routed creation entry point.
- [x] Character creation starts from a clean level-one build and opens the existing guided tools; dashboard rename and confirmed deletion management are live.
- [x] Add local campaign records, empty campaign creation, optional character assignment, campaign cards, and overview routes.
- [~] Join Campaign remains an honest backend placeholder until Supabase authentication and shared persistence from `BACKEND_PLAN.md` are implemented.

## Next active phase — Shared backend

Detailed architecture, schema, security rules, and rollout requirements live in [`BACKEND_PLAN.md`](./BACKEND_PLAN.md). The homepage integration order is:

1. **Supabase foundation** — project configuration, committed migrations, generated TypeScript types, RLS policies, and an optional client that does not break local mode when cloud configuration is absent.
2. **Authentication UI** — Google OAuth through Supabase Auth, email magic-link fallback, local guest mode, callback/session restoration, and sign-out.
3. **Explicit local-to-cloud import** — preview and confirm character imports, preserve local rollback data, prevent duplicates, and use revision checks.
4. **Shared campaigns and invitations** — cloud memberships, secure invite redemption, multi-campaign character assignment, and player-owned character permissions.
5. **Realtime campaign runtime** — state scoped by campaign and character, authorized subscriptions, GM actions, event history, retries, and conflict handling.

The immediate implementation target is step 1. Local characters and campaigns must remain fully usable throughout this phase.

## Delivery slices

### Slice 1 — App shell, routes, and persistence foundation — Complete

- [x] Add router and route-aware bootstrap.
- [x] Extract/wrap the existing sheet experience as `CharacterWorkspace` without changing rules behavior.
- [x] Add repository types and versioned local adapters.
- [x] Implement and test legacy character migration.
- [x] Scope current level and runtime state by character ID.
- [x] Add a Home link/back affordance to the character workspace.

**Exit condition:** `/` and character deep links work; existing saved builds remain accessible; refresh and browser history behave correctly.

### Slice 2 — Homepage UI — Complete

- [x] Build global header, welcome area, and quick actions.
- [x] Build campaign and character sections with populated and empty states.
- [x] Derive character card summaries from `CharacterBuild` through a small tested formatter.
- [x] Add responsive, keyboard, focus, contrast, and reduced-motion behavior.

**Exit condition:** users can identify and open any local character from the homepage on desktop or mobile.

### Slice 3 — Character creation and management — Complete

- [x] Route Create Character into the existing guided build flow using a new record.
- [x] Save edits to the selected character record rather than the global current-build key.
- [x] Support character rename and deletion with confirmation.
- [x] Link directly to sheet and build tabs from each card.

**Exit condition:** create, open, edit, refresh, and return home without losing or crossing character state.

### Slice 4 — Local campaign flows — In progress

Local creation, overview, cards, and many-to-many character assignment are complete. Online Join Campaign remains intentionally unavailable until authenticated shared persistence exists.

- [x] Implement Create Campaign with name and description; campaigns may begin empty, with optional character assignment during or after creation.
- [x] Add campaign overview and local character assignment/removal.
- [~] Implement Join Campaign form states behind a capability flag/API adapter — unavailable-backend state is live; authenticated invite states remain.
- [~] Show role, counts, linked characters, and timestamps accurately on homepage cards — local role/count/assignment metadata is live; precise activity timestamps remain.

**Exit condition:** local campaign organization is useful; unsupported online joining is honest and non-destructive.

### Slice 5 — Shared campaign backend (separate backend milestone) — Next

Supabase is selected. The next implementation task is project configuration, migrations, generated types, and RLS policies while preserving local mode.

- [x] Select Supabase for PostgreSQL, Auth, RLS, Realtime, and Edge Functions.
- [ ] Provision projects and commit schema migrations, generated types, and RLS policies.
- [ ] Implement cloud repositories, authorization, and invite redemption.
- [ ] Replace local campaign adapters through the existing interfaces while retaining guest mode.
- [ ] Add sync/conflict/error handling and integration tests.

**Exit condition:** two authenticated users can join the same campaign and see authorized shared state.

## Testing and verification

### Automated

- migration: empty, valid legacy state, malformed slot, duplicate snapshot, rerun/idempotence
- repositories: create/get/list/save/delete and storage failures
- summary formatting: multiclass and unnamed-character edge cases
- routing: homepage, deep-linked character/tab, unknown character, not-found route
- UI: populated lists, empty states, action destinations, keyboard activation
- existing workspace typecheck, tests, and production build remain green

Add focused web tests rather than snapshotting whole pages. Giant snapshots are just Where's Waldo for regressions.

### Manual

- verify existing browser data survives the migration
- test phone, tablet, and desktop widths
- test refresh/back/forward/deep links
- test keyboard-only navigation and visible focus
- test empty, one-item, and many-item lists
- test loading, invalid invite, unavailable backend, and storage-error states

## Acceptance criteria for the homepage MVP

- Visiting the root URL shows the homepage, not a character sheet.
- Existing local builds are represented as selectable character cards after migration.
- Selecting **Open Sheet** or **Edit Build** opens the correct character and tab.
- Creating a character produces a distinct persistent character record.
- Start Campaign creates a local campaign and returns it to the campaign list.
- Join Campaign never claims a remote join succeeded without backend confirmation.
- Empty states provide a clear next action.
- Navigation works with refresh, deep links, and browser back/forward.
- Character runtime state does not leak between characters.
- The layout works at 320 px width and with keyboard-only input.
- Typecheck, tests, lint, formatting check, and web production build pass.

## Confirmed product decisions

- A character may belong to multiple campaigns.
- Players always retain edit control over their characters; campaign GMs cannot lock them.
- Campaigns may be created empty and populated later.
- Campaigns appear before characters on the homepage.
- Supabase Auth is the selected authentication system, with Google OAuth as the primary login, email magic links as fallback, and local guest mode; the homepage still preserves provider-neutral repository boundaries.
