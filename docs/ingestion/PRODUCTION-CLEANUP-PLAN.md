# Production cleanup plan — do not execute in this task

No production mutation, deployment, import, deletion, account change or purge has been performed by this task. Production's project ref is documented as `guronltdufvmnwnjqggd`; it is explicitly rejected by the new service configuration. This document is a proposed operational plan, not an execution authorization.

## Current impact evidence

The committed artifact reports 10,083 source records, including 9,605 scraped records. Normalization changes row counts, so these are not a database census. The repository-only report contains every entity kind, missing-URL counts, 210 name-collision groups, known retained file paths, and unresolved downstream reference categories. Collision groups are not confirmed duplicates. No legacy record has yet been classified as confirmed excluded using record-level evidence in this audit; zero confirmed exclusions is **not** a finding that all records are eligible.

The runtime source metadata identifies Savage Company / SHM Publishing, but exact work membership and scope need review. The exception must not be expanded through related publisher names or rewritten as OGL. Other legacy license metadata remains unknown pending supporting evidence.

## Required staging rehearsal

1. Staging Supabase identity and aggregate reference inventory are verified in `STAGING-VERIFICATION.md`: seven characters, three with spell libraries, two with spell selections, one with nonempty equipment, and one runtime-state row. Campaign tables inspected were empty. Individual imported contributions and exact reference mappings remain unverified. Obtain the missing canonical-store, worker-volume, raw-cache and export inventory before cleanup.
2. Establish exact work/record/field evidence: eligible, confirmed excluded, unknown or the approved Savage Company exception. Produce immutable review decisions with citations and scope. Do not purge unknowns simply because metadata is absent.
3. Trace contributions through canonical fields, parser repairs, source overrides, derived engine modifiers, exports and search indexes. Treat mixed lineage as unresolved until a field can be reconstructed from eligible evidence. Preserve genuinely user-authored notes/homebrew separately from copied imported rules.
4. Generate a dry-run manifest with IDs, affected fields, eligible replacement evidence, reference paths, planned tombstones, every retained-copy action and expected counts. Include spellbooks, prepared/known lists, character builds, inventory references, campaign effects/events/documents and local/offline caches. Do not put excluded text into this report.
5. Approve the concrete staging plan; pause competing legacy imports/exports. Preserve IDs and references transactionally. Purge confirmed excluded contributions and reconstruct mixed records from eligible evidence; otherwise emit content-free unavailable placeholders. No cascading player/campaign deletion is permitted.
6. Remove disallowed copies from holding records, raw pages, AI input/output logs, historical snapshots, SQLite caches/WAL, runtime full/split JSON, source-controlled generated files, search indexes, embeddings if any, caches and exports under application control. Unknown content must not remain exposed as approved catalogue data in staging. Preserve minimal non-content purge metadata only.
7. Rebuild the full staging catalogue and app artifacts. Verify reference integrity, display/lookup behavior, all spell fields, source attribution and exclusion scans. Check cold and previously cached browsers. Invalidate controlled caches; explicitly report offline devices that have not received invalidation.
8. Record actual deleted/reconstructed/quarantined counts, tests, hashes, timestamps and inaccessible copies. No rollback snapshot may preserve excluded content as an ordinary recovery mechanism. Eligible consolidation history follows a separate policy.

## Subsequent production change

After staging passes, present the exact production manifest and impact to the user for separate authorization. Verify the actual production project/volume, maintenance window, references, user-authored data protection and source classifications afresh. Deploy the compatible unavailable-record behavior before affected content becomes unavailable. Execute the same reviewed deterministic procedure, followed by full reference/export/cache verification. Pause or retire the old auto-export entry points so content cannot be reintroduced.

Treat backups and immutable copies explicitly: `.cache/db-backups/*.dump`, Supabase backup/PITR retention, Docker images, Cloudflare deployments, Git objects/clones, downloads and offline devices. For each, record owner, location, access, ability to delete or sanitize, retention/expiry, and verified action. Inaccessible backups and external copies cannot be claimed erased. Obtain provider-specific retention evidence before promising a date or capability.

Production impact counts and exact user-facing affected records remain **unverified** until the inventory and staging rehearsal above are complete.
