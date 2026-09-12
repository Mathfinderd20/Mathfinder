# Cloudflare hosted staging — deployed, acceptance incomplete

The user selected Cloudflare and explicitly approved the scoped Wrangler OAuth grant. Backend and admin UI are deployed; one hosted Mage Armor job fetched, parsed and entered unknown-eligibility quarantine. Production remains untouched. See `HOSTED-DEPLOYMENT-20260912.md` for exact versions, tests and limitations.

## Arrangement

- UI: `https://stage.diresheets.com/admin/ingestion` in existing `mathfinder-stage`.
- Backend: `mathfinder-stage-ingestion`, route `stage.diresheets.com/api/ingestion/*`, account `bbd20759773ffe35ec98139df791b959`.
- Auth: verified staging Supabase `pkupqzdnefnjwndwzhdr`, server-managed catalogue administrator permission. No service-role credential is needed.
- Holding area: SQLite `Catalogue` Durable Object with the existing additive SQL schema, provenance and review interface. It is separate from Supabase gameplay data and approved catalogue assets.
- Background work: one page unit per alarm; persist a recovery alarm before work, then schedule the next unit. Existing leases, cancellation and retry behavior are reused. No PC-dependent process or competing schedule.
- Promotion remains locked. The existing staging catalogue was not replaced by the empty reviewed artifact.

SQLite Durable Objects are available on Workers Free subject to quotas. No paid upgrade was provisioned. Oversized rows are rejected with an actionable error; provider quotas may stop jobs. See [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

## Runtime security and evidence

The final Cloudflare transport uses its native HTTP API, `global_fetch_strictly_public`, no private-network/origin binding, exact HTTPS source scope, typed public-IP DNS preflight, manual validated redirects, robots, spacing and response limits. Provider public-only routing protects the actual connection against private destinations after DNS changes; Node retains IP pinning. The raw TLS socket experiment failed both locally and hosted and was replaced explicitly. There is no automatic insecure fallback. See [Cloudflare SSRF/binding model](https://blog.cloudflare.com/workers-environment-live-object-bindings/) and [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

Local provider-runtime tests verify rollback, row limits, admin/origin checks, alarms, restart persistence, quarantine, reprocessing, retries and cancellation. The fixed live probe retrieved 49,777 bytes. Content-db passes 101 tests and type checking. The focused UI passes build, type checking and 234 web tests. Hosted tests confirm authorization rejection, successful one-page extraction/quarantine, retry, reprocessing and persistence after reload. A live adversarial DNS-rebinding test has not been performed.

## Run and deploy

From the repository root:

```powershell
npm.cmd run typecheck --workspace @mathfinder/content-db
npm.cmd test --workspace @mathfinder/content-db
node scripts/test-cloudflare-ingestion.mjs
node scripts/test-cloudflare-ingestion.mjs --live-transport
```

The test entrypoint contains synthetic authentication/fixture routes and is never referenced by deployment config. Test state contains synthetic material only.

Backend deploy, from `packages/content-db`: `wrangler deploy --config wrangler.ingestion.jsonc`. First verify the exact staging account/config; `--dry-run` validates without writes. Never use the root production deployment command for the backend. The SQL migration applies only to its bound staging Durable Object.

`scripts/prepare-ingestion-stage-ui.mjs` exports the latest staging revision and adds only the import page/styles, route, profile link and environment type. It produces a build manifest and staging-only asset deployment config under `.cache`. The shared checkout contains unrelated edits and must not be packaged wholesale. The UI additions still need source-branch integration so later Git builds preserve them; set `VITE_INGESTION_API_URL=https://stage.diresheets.com/api/ingestion` in that build.

Administrators retry failed entries, cancel jobs and reprocess saved source through the UI. Alarms persist independently of the browser and PC; see [alarm semantics](https://developers.cloudflare.com/durable-objects/api/alarms/). The temporary local supervisor remains stopped. No localhost Auth callback is needed.

Provider journaling, point-in-time recovery, older deployments and external copies are separate retained copies. Local `secure_delete` does not erase provider history. Record actual provider retention in the cleanup manifest; no such erasure is claimed. See [storage and recovery](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

Eligibility/errata decisions, legacy contribution lineage, actual staging cleanup, catalogue cutover, source-branch integration and broader acceptance remain unfinished. Hosting is not final build acceptance. No broad crawl, catalogue promotion, cleanup purge or production change has occurred.
