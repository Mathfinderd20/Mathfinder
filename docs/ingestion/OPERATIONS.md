# Staging ingestion work in progress

This implementation is **deployed to staging for holding-area verification, not finalized or approved for production**. Read `HOSTED-DEPLOYMENT-20260912.md`, `REVIEW.md`, `ASTRA-DESIGN-RECOMMENDATIONS.md`, `REPOSITORY-IMPACT.json`, and `SAMPLE-RESULTS.json` together. The intended Astra review is complete; unresolved user decisions and evidence requirements remain.

## Architecture and compatibility

**Selected hosted runtime:** Cloudflare Worker + SQLite Durable Object + alarms, now deployed. See `HOSTED-STAGING-PLAN.md` for config, tests and operating steps. The Node/Docker instructions below remain optional development procedures; the user no longer needs a local server or callback. Promotion remains locked.

The existing app uses Supabase for authentication/gameplay and SQLite → JSON for catalogue data. The new path reuses `better-sqlite3`, Cheerio, Undici, `SpellDefinition`, and the existing `content_entities` table interface. Existing AoN parser fixtures remain regression coverage; the AoN parser is not reused for a different site's HTML. No AI calls or paid dependencies were introduced.

The additive SQLite migration is `packages/content-db/src/ingestion/migration.sql`. It creates jobs, entries, holding records, eligibility registry, canonical provenance overlays, source links, audit history, exception proposals and purge metadata. No Supabase migration is necessary for this proposed storage arrangement: browser clients cannot access these SQLite tables at all. Access is enforced by the Node API using a server-verified Supabase user. Supabase gameplay tables/policies are unchanged. The user approved the server-managed catalogue permission; their identified staging account has been provisioned and verified (see STAGING-VERIFICATION.md).

For optional Node development, the API and worker share one local disk volume; do not put SQLite WAL on a network filesystem. For the selected Cloudflare deployment, the shared API runs in a Worker and the existing SQL tables reside in one SQLite Durable Object. Alarms execute background page units. The supplied Docker alternative remains untested because Docker is unavailable.

Pipeline modules:

| Stage                | Implementation                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fetch                | `fetch.ts`: exact HTTPS source scope, public IPv4 DNS validation and connection pinning, TLS hostname preserved, manual validated redirects, robots, limits, delays, bounded HTTP retries |
| Parse                | `d20pfsrd.ts`: explicit article/statblock labels, safe description markup, separate target/effect/area, restricted directory discovery                                                    |
| Normalize / validate | `normalize.ts`: class-level tuples without inferred levels, raw level text, warnings and errors separate from completeness                                                                |
| Eligibility          | `model.ts`, `store.ts`: evidence-backed statuses, exact source URL/field scope, precise Savage Company exception                                                                          |
| Match / merge        | `model.ts`, `store.ts`: full identity, source URLs, field plans, protected edits, no name-only auto-merge                                                                                 |
| Review / promote     | `store.ts`, `server.ts`: candidate/registry/parser/schema/validation/plan digest, current revision and manual-edit fingerprint, transactional writes preserving IDs                       |
| Export               | `export.ts`: explicit reviewed spell-only export; `release.ts`: independently reviewed full catalogue copies, field evidence, unavailable manifest and runtime collision checks           |

The user approved retiring legacy automatic scrape/export in staging and activating a reviewed catalogue after validation. The legacy CLI now refuses mutating commands when staging/ingestion configuration or the new catalogue-job tables are detected; its parser QA report remains available. No existing ingestion schedule was found; none was added. The deployed staging transition has not yet happened.

## Optional Node development setup

The following disk/process setup applies only to optional Node development. For the selected Cloudflare deployment use `HOSTED-STAGING-PLAN.md`; no Containers purchase, local process, reverse proxy or loopback callback is required.

1. Dashboard authentication and the actual hosted staging project are now verified; see `STAGING-VERIFICATION.md`. CLI authentication remains unavailable. The checked web `.env.local` targets loopback, not hosted staging.
2. Verify the actual staging project independently through the authenticated project inventory/dashboard and the running stage application's configuration. The repository names `pkupqzdnefnjwndwzhdr`; production is `guronltdufvmnwnjqggd`. Record evidence of the project identity and the staging disk volume before writes. Merely filling in an environment variable is not verification.
3. The user approved server-controlled `app_metadata.catalogue_role = 'admin'` and their exact staging account was provisioned. The API verifies it via the pinned staging `/auth/v1/user` endpoint. `user_metadata`, campaign GM roles, hidden buttons, and offline identity are not authorization.
4. Create `packages/content-db/.env.ingestion` from its `.env.example` **on the confirmed staging host**. Store credentials outside Git. The API only needs the publishable key and the user's token; no service-role key is sent to the browser. Record target verification and permission-review evidence IDs.
5. Provide `INGESTION_POLICY_APPROVAL_FILE` only for resolved policy scope. It must contain actual decision references for `user`, `astra`, and `transition`; empty/missing entries keep canonical promotion locked. The conditional staging transition is approved, but specific source classifications, R02/R03/R11 and R17 remain unresolved. Do not invent approval IDs to unlock testing against real data. Fixture tests use synthetic approvals on in-memory databases only.

Run separate processes from the repository root, with the above environment loaded:

```powershell
npm.cmd run ingestion:serve --workspace @mathfinder/content-db
npm.cmd run ingestion:work --workspace @mathfinder/content-db
```

Or, after Docker and environment verification:

```powershell
docker compose -f packages/content-db/ingestion.compose.yaml up --build
```

The Docker API port is bound to loopback. Configure a staging-only TLS reverse proxy; do not expose port 8788 publicly. Point `VITE_INGESTION_API_URL` at the API base ending in `/api/ingestion`, and build with `VITE_APP_ENV=staging` and the verified stage Supabase configuration. The route is `/admin/ingestion`, linked from the staging profile menu. No production route or deployment has been activated.

## Administrative workflow

### Authorized local staging verification

**Superseded:** the user selected Cloudflare hosting. The local supervisor has been stopped, and adding a loopback Auth callback is no longer needed. Keep the following commands as an optional development procedure only. Current hosted steps are in `HOSTED-STAGING-PLAN.md`.

The user approved temporary local execution. `scripts/run-ingestion-local.mjs` builds an isolated preview, then supervises separate API, worker and preview processes. It binds ports 8788 and 5179 to `127.0.0.1`, pins staging authentication, uses `packages/content-db/data/local-staging/ingestion.sqlite`, and locks promotion. It never kills unrelated processes or changes a deployed asset. Failure of a supervised service stops its companions. The ignored local environment file contains the publishable key and verification references, not a service-role credential.

```powershell
node scripts/run-ingestion-local.mjs --check
node scripts/run-ingestion-local.mjs
```

Open `http://127.0.0.1:5179/admin/ingestion`. Ctrl+C stops the supervisor and its services; the isolated database persists for the next run. The PC must remain on. This is a local verification arrangement, not hosted deployment or a startup service. The preview's quarantine-only catalogue intentionally has no approved records; do not use it to validate ordinary character creation.

Only if optional local browser development is resumed would staging Auth need the loopback callback. It was not added. The selected hosted workflow uses the already configured `https://stage.diresheets.com/auth/callback`; no Auth URL change is pending.

- Select the supported source, a URL and single-detail or directory mode. The backend validates and persists the scope. The worker performs retrieval outside HTTP requests.
- Discovery follows supported list/table entries and explicit next/pagination links. It caps total discovered pages at 100, depth at 3 and previews at three detail attempts. Counts are explicitly partial if a limit is reached. One failed page remains independently retryable.
- Confirm import to fetch the remaining discovered details into holding. This confirmation does not approve changes to canonical data.
- Review category, payload, field warnings, source, candidate plans and conflicts. Enter record/work eligibility evidence and resolve publication/variant identity. No record is automatically classified from its domain. Unknown data remains admin-only quarantine.
- Canonical promotion is separate, requires settled operational policy gates, and binds to the displayed review digest. Changes in candidate, validation, versions, registry or canonical values invalidate approval. Ordinary edits made outside the provenance overlay block automated updates.
- Cancelling changes persisted job state. A running worker polls cancellation while fetching and checks its lease before writes. Failed-entry retries preserve successful work. Expired leases can be reclaimed; stale owners cannot persist late results.
- Reprocess retained source from the UI without refetching. Already-promoted records produce a new holding job/revision; their canonical values remain unchanged. The original retrieval time is preserved. Parser identities are compared for equality rather than lexicographic ordering.
- Review extracted and normalized payloads separately. Field-scoped correction proposals require eligible same-identity evidence, a supporting authority URL and explicit approval. Their candidate hashes, actor and evidence are persisted. Approving a correction does not promote it. Withdrawal invalidates affected plans and requires a replacement decision before an affected corrected record can be exported.
- Jobs retain a versioned source-policy snapshot including entry/pagination rules and crawl limits. A changed policy stops processing for review before retrieval; durable entry attempts, worker leases and active runtime survive restart.
- `GET /api/ingestion/export` produces the approved spell-only export for an authenticated catalogue admin. It is a review artifact, **not automatic activation** and not a substitute for a full existing catalogue. Activation must preserve all other eligible kinds and references, validate the full runtime contract, and rebuild/invalidate stage caches before deployment.

## Fixtures and verification

For the full catalogue transition, prepare a release from a reviewed JSON decision file:

```powershell
node --import tsx scripts/prepare-catalogue-release.ts INPUT_JSON REVIEW_JSON
```

The review file contains `transitionReference`, `decisions` and `evidence`. Each decision binds its collection scope, stable record ID, exact payload hash, reviewer, review reference, origin and field evidence IDs; see `ReleaseDecision` in `release.ts`. Normalized and pack copies require independent decisions. Unknown or stale decisions produce unavailable manifest entries. Conflicting retained copies and runtime name collisions block release. R17-affected casting classes remain blocked pending their specific progression review.

Output is an ignored `packages/content-db/data/releases/<hash>/usable-content.json` artifact. Set `INGESTION_RUNTIME_RELEASE` to that exact artifact only for a reviewed staging build; the Vite integration validates target and digest, excludes legacy full/split catalogue assets and versions caches with the new hash. Preparing or building an artifact does not deploy it. The current zero-approved test release must not be mistaken for a completed or populated catalogue.

```powershell
npm.cmd run test --workspace @mathfinder/content-db
npm.cmd run typecheck --workspace @mathfinder/content-db
node scripts/audit-ingestion.mjs
node --import tsx packages/content-db/src/ingestion/cli.ts sample
node --import tsx scripts/reprocess-ingestion-fixtures.ts
```

`sample` uses a fixed twelve-URL list; `sample-third-party` adds two explicitly supported Dreamscarred Press/Rite Publishing URLs. Both use robots checks and request spacing. Live source fragments are stored in ignored `packages/content-db/data/quarantine-fixtures/`; they are not a distributable approved fixture pack. `.dockerignore` excludes them. Only metadata reports are in Git. The committed synthetic HTML fixture is original test material. Reprocessing updates the local samples after parser fixes without network access. Current parser version is 1.2.0, including pre-description exceptional text, line breaks and safe table spans.

The live sample retrieved 13 of 14 pages; Summon Monster I's requested URL returned 404. Four retrieved pages contain additional variant/correction sections and are blocked for review. All 13 remain unknown eligibility/quarantine. Zero stage imports, promotions or purges have been performed. The 100-spell run is not started while sample validation and deployment remain unresolved. No site-wide crawl was run. `SAMPLE-RESULTS.json` records per-field presence and flags; presence alone does not establish validity, completeness or authority.

Tests exercise parser formatting, exceptions, separate spell fields, zero levels, duplicate labels, variants, domain labels, discovery scope/loops/limits, robots, destination validation, precise exceptions, merge conflicts/protected fields, errata preservation, version changes, leased claims, failed-page recovery, three-attempt previews, confirmation boundaries, stale reviews, duplicate jobs, external edits, export fidelity, local purge and HTTP authorization/orchestration. Mocked authorization tests are not hosted Supabase RLS verification.

## Cleanup operations and limits

`cleanupImpact` is a dry-run, all-kind inventory for **reviewed exact evidence** in the accessible SQLite store. `purgeEvidence` removes affected canonical contributions, restores eligible baseline contributions where available, clears related holding raw/payload/plan/AI records and local page cache, redacts canonical history and legacy run free-text metadata, and keeps canonical IDs with unavailable placeholders when reconstruction is insufficient. It does not write player/campaign tables.

Do not call it against real data until the confirmed staging inventory, classifications, mixed-contribution lineage, user-authored fields and downstream references have been reviewed. Its authorization object is an operator precondition, not independent proof of staging identity. No purge endpoint is exposed to the browser. Further guardrails and an operational manifest covering every retained-copy store are necessary before executing real cleanup.

After a reviewed staging purge, stop writers, verify deleted text is absent from active tables and derived artifacts, checkpoint/truncate WAL, and vacuum as appropriate for the staging volume. `secure_delete` alone does not erase old WAL, filesystem snapshots or backups. Browser caches, exported files, container images, Git history and hosted backups are outside this function and must be inventoried/remediated separately. Never describe them as erased without verification. See `PRODUCTION-CLEANUP-PLAN.md`.

## Outstanding implementation and verification

- Worker host/volume verification, deployment, and browser end-to-end acceptance. Hosted Supabase identity and administrator provisioning are verified; production remains untouched.
- User decisions on substantive legacy rules, especially R02/R03/R11 and the new R17 progression/equivalence review; all-entity eligibility classifications and actual staging cleanup. The conditional staging transition itself is approved.
- Savage Company and verified-errata source fixtures with supporting work evidence. Two third-party pages now supplement the original sample; this remains an incomplete publisher matrix.
- Correctly splitting multi-variant pages and interpreting additional correction blocks. Such pages are currently quarantined; no missing base values are inferred.
- Generic repeated-record single-page extraction, alternative directory layouts, browser rendering and other adapters. Unsupported layouts are reported, not claimed as supported.
- HTTP retry/request accounting across process restarts needs additional stress verification before scaling. Active wall time is persisted; a shared worker lease serializes live retrieval and spaces consecutive pages. The per-fetcher request count is still process/phase scoped, with durable entry attempt limits.
- Hosted acceptance of the implemented field-scoped correction approval/withdrawal workflow, including a real eligible authoritative correction. Local synthetic tests do not establish source authority.
- Reviewable legacy mapping/consolidation execution and fully verified reference updates. `consolidation.ts` currently produces a proposal only; it filters excluded contributions from both effective and baseline recovery snapshots.
- Registry amendments are recorded in `catalogue_registry_history` and invalidate review digests. Exclusion changes involving retained copies require the operator cleanup procedure; the browser cannot bypass it.
- Mixed-field raw pages are not retained when a field is already confirmed excluded. Canonical reconstruction from eligible baseline is tested, but isolated eligible source fragments, derived contribution lineage and the external-copy purge manifest need further work before real cleanup. The local purge tests do not prove complete staging erasure.

These are explicit unfinished items. The build must not be represented as the completed application feature until they and the required reviews are resolved.

## Adding an adapter

Implement source-specific URL validation, extraction and discovery with explicit scoped link rules; produce the existing `SpellPayload`/warning contract and a stable parser version. Keep normalization and eligibility separate. Add evidence-controlled fixtures covering actual layouts and failure cases before enabling any URLs. Route candidates through the same holding/review store, never through legacy auto-export or another schedule. A source registry entry is not proof of every record's eligibility.
