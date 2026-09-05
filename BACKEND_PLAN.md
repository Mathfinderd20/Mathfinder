# Mathfinder Backend Plan

## Decision summary

Use **Supabase** as Mathfinder's shared backend:

- Supabase PostgreSQL for application data
- Supabase Auth for identity and sessions
- Google OAuth as the primary sign-in method
- Email magic links as the fallback sign-in method
- Local guest mode for offline character creation and editing
- PostgreSQL Row-Level Security (RLS) for authorization
- Supabase Realtime for campaign-scoped live state
- Supabase Edge Functions for privileged, atomic workflows
- Supabase Storage later for portraits, exports, and campaign assets

Do not build a custom Node API until concrete requirements exceed Supabase's database, RLS, RPC, and Edge Function capabilities. Infrastructure should serve the game, not become the final boss.

## Implementation status

- [x] Supabase CLI configuration is committed under `supabase/`.
- [x] Initial gameplay schema and RLS policies are committed as a migration.
- [x] The frontend has an optional PKCE-configured client that leaves local mode untouched when cloud environment variables are absent.
- [x] A static schema contract verifies all gameplay tables have RLS enabled.
- [ ] Start the local Supabase stack and execute database lint/policy tests — currently blocked until Docker is running.
- [ ] Generate database TypeScript types from the running local schema.
- [ ] Link/provision managed development, staging, and production projects.

Useful commands: `npm run supabase:start`, `npm run supabase:reset`, `npm run supabase:lint`, `npm run supabase:verify`, and `npm run supabase:types`.

## Goals

The backend must support:

1. User accounts and cross-device sessions
2. Player-owned characters
3. Characters assigned to multiple campaigns
4. Empty campaign creation and later character assignment
5. GM/player campaign memberships
6. Secure, revocable campaign invitations
7. Campaign-specific runtime state and shared effects
8. Realtime updates for active play
9. Local guest use and eventual cloud import
10. A future web and mobile client through the same contracts

## Confirmed product rules

- A character may belong to multiple campaigns.
- The player who owns a character always controls its build.
- Campaign GMs can view assigned characters but cannot lock or edit their canonical builds.
- Campaigns may be created without assigned characters or invited players; the creator is its initial GM member.
- Campaigns appear before characters on the homepage.
- Online campaign features require authentication.
- Local character creation and editing should remain available without authentication.

## System boundaries

```text
Web app / future mobile app
  ├── Local repositories and offline cache
  ├── Supabase Auth client
  ├── Supabase data client
  │    ├── PostgreSQL tables and views
  │    ├── Row-Level Security
  │    └── Realtime subscriptions
  └── Edge Functions / database RPC
       ├── Redeem invitation
       ├── Transfer campaign ownership
       ├── Apply privileged campaign action
       └── Other trusted multi-table transactions

Existing content pipeline
  └── Local SQLite -> validated runtime content export
```

### Client responsibilities

- Render the homepage, character workspace, and campaign views.
- Run the deterministic rules engine.
- Maintain local guest records and an offline cache.
- Perform optimistic updates with revision checks.
- Subscribe only to relevant campaign channels.
- Present sync, authorization, and conflict errors honestly.

### Backend responsibilities

- Authenticate users and refresh sessions.
- Enforce ownership and campaign permissions.
- Persist canonical cloud records.
- Redeem and revoke invitations atomically.
- Store campaign-specific runtime state.
- Broadcast authorized realtime changes.
- Record important GM/runtime actions for accountability.

### Content pipeline responsibilities

The existing `packages/content-db` SQLite workspace remains the build-time ingestion, normalization, and QA system for rules content. It should not become the user-data backend.

Runtime rules content should continue to ship as a validated, versioned, cacheable asset unless a later requirement justifies hosted content delivery.

## Authentication

Implementation update (September 2026): `AUTHENTICATION.md` supersedes the guest
mode and local-import proposals below. Permanent accounts are required;
IndexedDB provides account-scoped, read-only outage viewing. Anonymous login
and silent local-record import have been removed.

Supabase Auth is the authentication system. Google is a provider used through Supabase Auth, not a separate authentication stack.

```text
Mathfinder -> Supabase Auth -> Google OAuth
```

Supabase handles:

- OAuth redirects and callbacks
- Supabase user creation/linking
- access and refresh tokens
- browser session persistence
- authenticated user identity for RLS through `auth.uid()`

### Initial sign-in methods

1. **Continue with Google** — primary
2. **Email me a sign-in link** — fallback
3. **Continue locally** — guest mode

Consider Discord later for the tabletop audience and Apple before an iOS release. Do not add passwords unless product demand justifies their recovery and security burden.

### Guest-mode behavior

Guest users can:

- create and edit local characters
- use the character sheet offline
- organize local-only campaigns

Guest users cannot:

- join shared campaigns
- send online invitations
- sync across devices
- participate in shared realtime state

When a guest chooses an online feature, prompt for sign-in and then offer a deliberate import of local records. Never silently upload local characters.

### Frontend auth structure

Create one auth provider/session boundary for the app. UI components consume user/session state and application services; they should not call Supabase Auth independently.

Use OAuth with PKCE and configure exact redirect URLs for local development, preview deployments, production web, and future mobile deep links.

## Data model

Use UUID primary keys, `timestamptz` timestamps, foreign keys, and database constraints. Keep frequently queried homepage fields relational while storing the full rules-engine build as versioned `jsonb`.

### `profiles`

Application-facing data associated with `auth.users`.

```text
id                  uuid PK -> auth.users.id
handle              text nullable unique
display_name        text
avatar_url          text nullable
created_at          timestamptz
updated_at          timestamptz
```

A trigger may create a basic profile after signup, but it must tolerate retries and missing provider metadata.

### `characters`

```text
id                  uuid PK
owner_id            uuid FK -> profiles.id
name                text
ancestry_name       text
class_summary       text
level               integer
build               jsonb
build_version       integer
revision            integer
created_at          timestamptz
updated_at          timestamptz
archived_at          timestamptz nullable
```

- `build` stores the canonical `CharacterBuild` document.
- Summary columns make homepage queries cheap and stable.
- `build_version` selects application migration logic.
- `revision` supports optimistic concurrency.
- Archive first; hard deletion can be a separate confirmed operation.

Do not normalize every level, feat, spell, and inventory item into hosted tables initially. The rules engine already owns that coherent aggregate.

### `campaigns`

```text
id                  uuid PK
owner_id            uuid FK -> profiles.id
name                text
description         text nullable
revision            integer
created_at          timestamptz
updated_at          timestamptz
archived_at          timestamptz nullable
```

A campaign can exist before it has additional members or assigned characters; its creator is added as the initial GM member.

### `campaign_members`

```text
campaign_id         uuid FK -> campaigns.id
user_id             uuid FK -> profiles.id
role                campaign_role ('gm', 'player')
joined_at           timestamptz

PK (campaign_id, user_id)
```

The campaign owner receives a GM membership. Role changes must be protected from self-promotion.

### `campaign_characters`

Explicit many-to-many assignment:

```text
campaign_id         uuid FK -> campaigns.id
character_id        uuid FK -> characters.id
assigned_by         uuid FK -> profiles.id
assigned_at         timestamptz

PK (campaign_id, character_id)
```

Assignment does not transfer ownership or edit rights. Removing one assignment does not affect the character's other campaigns.

### `campaign_invites`

```text
id                  uuid PK
campaign_id         uuid FK -> campaigns.id
created_by          uuid FK -> profiles.id
code_hash           text unique
role                campaign_role
expires_at          timestamptz nullable
max_uses            integer nullable
use_count            integer
revoked_at           timestamptz nullable
created_at           timestamptz
```

Only the invitation URL exposes the random code. Store a cryptographic hash in the database. Redemption validates expiration, revocation, and usage limits in one trusted transaction.

### `character_runtime_states`

A character used in several campaigns needs separate HP, resources, ammunition, spell usage, and combat state in each one.

```text
id                  uuid PK
character_id        uuid FK -> characters.id
campaign_id         uuid FK -> campaigns.id nullable
state               jsonb
state_version       integer
revision            integer
updated_by          uuid FK -> profiles.id
updated_at          timestamptz
```

Enforce one state per `(character_id, campaign_id)`. A null campaign represents the owner's solo state and needs a partial unique index because null handling in ordinary unique constraints is delightfully unhelpful.

### `campaign_effects`

```text
id                  uuid PK
campaign_id         uuid FK -> campaigns.id
source_character_id uuid FK -> characters.id nullable
effect_key          text
payload             jsonb
active              boolean
created_by          uuid FK -> profiles.id
created_at          timestamptz
expires_at          timestamptz nullable
```

This supports auras, group buffs, environmental conditions, and GM-applied effects without copying effect state into every character build.

### `campaign_events`

```text
id                  uuid PK
campaign_id         uuid FK -> campaigns.id
actor_id            uuid FK -> profiles.id
event_type          text
subject_type        text
subject_id          uuid nullable
payload             jsonb
created_at          timestamptz
```

Record meaningful campaign actions such as damage, healing, conditions, character assignment, and invitation changes. Do not log every UI click or keystroke.

## Authorization with Row-Level Security

RLS is mandatory on every user-data table. A hidden button is UX; it is not security.

### Profiles

- Authenticated users can read the limited profile fields needed for shared campaigns.
- Users can update only their own profile.

### Characters

- Owners can create, read, update, archive, and delete their characters.
- Campaign members can read characters assigned to their campaigns.
- Campaign GMs cannot update player-owned builds.
- Assignment never changes `owner_id`.

### Campaigns and memberships

- Members can read campaigns they belong to.
- GMs can update campaign metadata and manage invitations.
- Players can leave campaigns.
- Users cannot promote themselves.
- Ownership transfer uses a protected transaction.
- The last owner/GM cannot disappear without an explicit transfer or campaign archive operation.

### Character assignments

- A character owner can approve or remove their character's assignment.
- A GM can invite/request an eligible character assignment.
- The final assignment flow should not let a GM attach arbitrary characters they merely know the UUID of.

### Runtime state and campaign actions

Initial recommendation:

- Character owners can directly update their campaign-specific runtime state.
- GMs apply damage, healing, conditions, and effects through trusted campaign actions.
- GM actions produce `campaign_events` entries.
- RLS confirms both campaign membership and character assignment.

This preserves player ownership while allowing a GM to run the session. The exact undo/dispute UX remains a later product decision.

## API and service boundaries

### Direct Supabase client

Use direct, RLS-protected queries for ordinary operations:

- list/open/save owned characters
- list campaigns and memberships
- read assigned campaign characters
- update own profile
- subscribe to authorized realtime changes

### Database functions or Edge Functions

Use trusted functions for operations that require secrets, elevated authority, or atomic multi-table changes:

- create and redeem invitation codes
- revoke invitations
- transfer campaign ownership
- remove members and resolve their assignments
- apply GM runtime actions and append event records
- import a batch of local records idempotently

Prefer a PostgreSQL function for small database-only transactions. Use an Edge Function when logic needs external services, provider APIs, secrets, or substantial TypeScript validation.

Do not introduce `services/api` simply as a pass-through wrapper around Supabase. Add a custom API only when it owns real behavior.

## Realtime strategy

Use realtime selectively.

### Realtime data

- campaign membership and character assignments
- campaign-specific HP/resources/runtime state
- active campaign effects
- meaningful campaign events
- presence during an active session, later

### Ordinary persisted saves

- character build editing
- profile changes
- campaign descriptions and settings
- character creation

Do not broadcast each build-editor keystroke. Save intentionally or with a debounced repository operation.

### Subscription scope

Clients subscribe only to campaigns currently open or actively monitored. Authorization must be enforced before joining private broadcast channels or receiving row changes.

## Concurrency and conflict handling

Mutable aggregate records use a `revision` integer. Updates include the expected revision:

```sql
update characters
set build = :build,
    revision = revision + 1,
    updated_at = now()
where id = :id
  and owner_id = auth.uid()
  and revision = :expected_revision;
```

If zero rows update, the client has stale data. It should reload and offer an explicit resolution path rather than silently overwriting newer work.

Runtime actions should be atomic and idempotent where retries are possible. Client-generated operation IDs can prevent duplicate damage or invite redemption after reconnects.

## Local-first and synchronization plan

Keep repository interfaces independent of storage technology:

```ts
interface CharacterRepository {
  list(): Promise<CharacterSummary[]>;
  get(id: string): Promise<CharacterRecord | undefined>;
  create(input: NewCharacterInput): Promise<CharacterRecord>;
  save(record: CharacterRecord): Promise<CharacterRecord>;
  archive(id: string): Promise<void>;
}
```

Initial adapters:

```text
LocalCharacterRepository
SupabaseCharacterRepository
```

### Import flow

1. User signs in.
2. App detects unlinked local records.
3. App shows exactly what can be imported.
4. User confirms the import.
5. A trusted idempotent operation creates cloud records.
6. Local records store their cloud IDs only after server confirmation.
7. Local data remains available as a cache and rollback source.

### Offline evolution

Do not build a generalized sync engine in the homepage slice. Establish repositories and explicit import first. Later:

- cache server records locally
- queue offline mutations with operation IDs
- replay them after reconnect
- use revision checks
- surface conflicts and failed operations

## Validation and versioning

- Validate JSON payloads at client and trusted-function boundaries.
- Persist `build_version` and `state_version`.
- Keep migrations deterministic and tested.
- Reject unsupported future versions rather than guessing.
- Generate TypeScript database types from the Supabase schema in CI.
- Never expose the Supabase service-role key to web or mobile clients.

## Deployment and environments

Use separate Supabase projects for at least:

- local development
- staging/preview
- production

Recommended deployment shape:

- Frontend: Cloudflare Pages or Vercel; make the final choice when deployment work begins
- Backend: managed Supabase
- Schema migrations: Supabase CLI with committed SQL migrations
- Server logic: Supabase Edge Functions in TypeScript/Deno
- Client error reporting: Sentry
- Database logs/metrics: Supabase initially
- Backups: managed production backups plus periodic logical exports

Environment configuration must include only public project URL/anonymous keys in the frontend. Secrets belong in Supabase or deployment-provider secret stores.

## Delivery phases

### Phase 1 — Local repository boundary

- Extract local character and campaign repositories.
- Implement versioned legacy migration.
- Scope runtime state by character and local campaign context.
- Keep the homepage usable without accounts.

**Exit condition:** all current local data works through provider-neutral interfaces.

### Phase 2 — Supabase foundation

- Create development Supabase project.
- Add committed schema migrations.
- Generate TypeScript database types.
- Implement profiles, characters, campaigns, memberships, assignments, and RLS.
- Add automated policy tests.

**Exit condition:** unauthorized users cannot access another user's private data, even with direct API requests.

### Phase 3 — Authentication and cloud characters

- Add Google OAuth through Supabase Auth.
- Add email magic links.
- Add auth callback/session UI.
- Implement explicit local-character import.
- Add cloud character repositories and revision checks.

**Exit condition:** users can sign in on another device and access their imported characters.

### Phase 4 — Shared campaigns and invitations

- Implement campaign membership and character assignments.
- Implement hashed, expiring, revocable invitation codes.
- Add invite redemption through a trusted transaction.
- Enforce player ownership and GM permissions.

**Exit condition:** two authenticated users can join one campaign and see only authorized records.

### Phase 5 — Realtime runtime state

- Add campaign-specific runtime records.
- Add authorized realtime subscriptions.
- Add GM action functions and event history.
- Add reconnect, retry, idempotency, and conflict handling.

**Exit condition:** authorized clients see session updates promptly without runtime state leaking across campaigns.

### Phase 6 — Production hardening

- Add staging and production projects.
- Verify OAuth redirect and mobile deep-link configuration.
- Add monitoring, backups, rate limits, abuse controls, and retention rules.
- Run an RLS/security review and multiplayer load test.

**Exit condition:** production recovery, observability, and security procedures are documented and tested.

## Test strategy

### Database and policy tests

- owner character CRUD
- non-owner character denial
- assigned-character campaign visibility
- GM inability to edit canonical player builds
- self-promotion denial
- multi-campaign character assignment
- invitation expiration, revocation, usage limit, and replay
- campaign-specific runtime isolation

### Application integration tests

- Google callback/session restoration
- magic-link callback
- sign-out and expired sessions
- local guest to signed-in import
- offline mutation retry
- optimistic-concurrency conflict
- realtime authorization and unsubscribe behavior

### Operational tests

- migration against staging
- restore from backup
- key rotation
- revoked member losing realtime and query access
- malformed/future-version JSON rejection

## Non-goals for the first backend slice

- A custom general-purpose Node API
- Server-side recalculation of every character statistic
- Normalizing the complete rules catalog into hosted gameplay tables
- Collaborative build-editor keystroke synchronization
- Full event sourcing
- Automatic merging of conflicting character builds
- Uploading guest data without explicit consent

## Remaining decisions

These do not block the local homepage foundation:

1. Cloudflare Pages or Vercel for the web frontend
2. Whether a GM runtime action applies immediately or requires player confirmation
3. Campaign event-history retention duration
4. Whether character assignment requires explicit player approval every time
5. When offline mutation queues become necessary beyond explicit local import

Choose these when their delivery phase begins. Prematurely deciding every knob is architecture astrology, not planning.
