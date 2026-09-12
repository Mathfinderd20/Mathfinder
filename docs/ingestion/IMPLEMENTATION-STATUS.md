# Scraper implementation status — not finalized

**Latest result (2026-09-12):** Cloudflare OAuth was approved and completed. Backend and focused staging admin UI are deployed. One hosted Mage Armor job fetched, parsed and entered unknown-eligibility quarantine; promotion stays locked. Hosted retry, reprocessing and reload persistence were verified. See `HOSTED-DEPLOYMENT-20260912.md` for versions, the public-network HTTP adaptation and precise limits. The local supervisor is stopped and no localhost callback is needed.

Updated 2026-09-12 UTC. Production remains untouched. Staging Supabase access and the requested administrator grant are verified. The holding-area schema exists in the dedicated Cloudflare Durable Object. No canonical catalogue cutover, promotion or cleanup purge has been executed.

## Completed implementation and local evidence

- Reused SQLite catalogue interfaces, Cheerio, Undici, stable spell definitions and the existing 21 content-db regression tests. The inspected legacy implementation is AoN ingestion with automatic JSON export; no existing AI integration or d20PFSRD adapter was found in this checkout. See `REVIEW.md` for implementation locations and unexpected rules.
- Implemented a deterministic d20PFSRD spell adapter, versioned scoped retrieval, separate extraction/normalization, validation, evidence registry, private holding area, field merge plans, transactional review/promotion, correction approval/withdrawal and selective reprocessing. Exact publication evidence is required; public access and domain names never establish eligibility. Savage Company remains a separate, precisely scoped exception.
- Added separate authenticated Node API and background worker, additive SQLite migrations, persisted jobs/leases/cancellation/retries, staging-only configuration guards, an admin interface and operating configuration. Existing canonical IDs are preserved during enrichment. Manual fingerprints, protected fields, ambiguous matches and conflicting values stop automatic updates.
- Added all-kind cleanup impact/purge primitives with synthetic mixed-contribution, retained-copy and user-data-preservation tests. Actual classifications and the complete external-copy manifest remain unfinished. These tests do not demonstrate staging erasure.
- Implemented reviewed full-catalogue release preparation, field evidence for each retained copy, content-free unavailable manifests, runtime collision checks, stage-only build activation and cache-version changes. Legacy automatic ingestion/export is blocked when staging/ingestion configuration or the new store is detected. Nothing has been activated.
- Preserved spell formatting, table spans, exceptional prose, separate target/effect/area and attribution in the parser and display. No paid AI dependency or autonomous AI decisions were added; exception proposals remain disabled by default and budgeted when an implementation is supplied.

Latest content-db verification: 101 tests and type checking pass. Local Cloudflare runtime tests pass rollback, row limits, admin/origin checks, alarms, restart persistence, quarantine, reprocessing, retry and cancellation. The isolated latest-stage UI build and type checking pass, with 234 web tests. Earlier full-workspace counts were rules-data 5 and rules-engine 303; those checks predate this adaptation.

A fresh isolated web build and static-content split passed. The build used an intentionally invalid publishable key and is not deployable authentication configuration. Its all-unknown release contained zero approved rows and 20,252 unavailable normalized/pack copies, demonstrating that unreviewed content does not enter the reviewed catalogue. This is neither a populated catalogue nor a purge of existing deployments. Original application assets were not replaced.

## Live source sample

Parser 1.2.0 reprocessed 13 retained pages without refetching. Fourteen fixed URLs were attempted in total, including Dreamscarred Press and Rite Publishing layouts. One requested Summon Monster I URL returned 404. Four pages contain additional variant/correction sections that require review. All 13 retrieved records remain unknown eligibility and quarantined.

| Outcome                                                                    |  Count |
| -------------------------------------------------------------------------- | -----: |
| Additions / enrichments / corrections / unchanged / conflicts / exclusions | 0 each |
| Quarantined                                                                |     13 |
| Fetch failures                                                             |      1 |
| Promoted                                                                   |      0 |

`SAMPLE-RESULTS.json` provides field-presence and warning counts. A populated field is not proof of correctness or authority. No 100-entry or site-wide crawl has been run. Raw samples and runtime comparisons are private ignored files and are included in the retained-copy inventory.

## Review and deployment dependencies

The user confirmed the Astra reviewer and approved the conditional staging transition. `ASTRA-DESIGN-RECOMMENDATIONS.md` and `ASTRA-R17-REVIEW.md` record the completed design reviews. Specific R02/R03/R11 rules, publication eligibility/authority, legacy mappings and R17 progression rules remain unresolved. The blanket progression bypass was removed; affected class releases are blocked instead. Existing staging and production class behavior is unchanged.

The runtime comparison changes Cleric, Druid, Paladin, Ranger and Sorcerer payload fields and identifies eight race-name collision groups. Authoritative table comparison is still required. Staging aggregate queries found a character with one Druid level and a character with one Sorcerer level; these per-class counts do not establish distinct characters or a measured gameplay change.

The correct Cloudflare account and staging Supabase target are verified. The backend now has its dedicated staging-only Worker route and SQLite Durable Object. The focused UI was deployed from an isolated staging revision, excluding unrelated dirty files. No paid upgrade was provisioned. Promotion remains locked. Source-branch integration is still needed to preserve the UI on later Git-triggered builds.

No localhost callback change is needed. Wrangler OAuth succeeded after explicit user approval. The raw TLS socket failed locally and hosted; the final documented public-only HTTP transport succeeded in both. See `HOSTED-DEPLOYMENT-20260912.md`, `HOSTED-STAGING-PLAN.md` and `CLOUDFLARE-VERIFICATION.md`.

Still required: source-branch integration, review decisions, evidence-backed source classifications, complete retained-copy/reference lineage and staging cleanup, verified publisher/errata fixtures, multi-variant extraction, broader hosted acceptance including review/promotion, a larger bounded import after eligibility/validation gates pass, and a concrete production impact manifest. Inaccessible backups, Git history, old deployments and offline copies have not been erased. `PRODUCTION-CLEANUP-PLAN.md` is a plan only.

See `OPERATIONS.md` for worker commands, retries, reprocessing, corrections, adapter extension and known limits. This document records progress; it is not final acceptance or authorization for production.
