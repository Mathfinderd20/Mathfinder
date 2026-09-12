I am the author of the consolidated specification in this task and can provide its design review. I cannot independently verify that this is the specific task/model the user intended as “Astra.” Record this as **specification-author design review**, not confirmed Astra identity or new user approval.

I read `REVIEW.md`. The review below relies on its reported findings; I did not independently inspect the implementation, rerun tests, or access a database. I have not changed files, contacted other tasks, or touched production. The proposed output location is outside this task’s writable roots, so I’m returning the review here.

:::writing{variant="document" id="82641"}

# Scraper design review — R01–R16

Status: Design recommendations issued. Legacy transition, unresolved source policies, and required user decisions remain pending.

## Overall assessment

The proposed isolated holding pipeline is consistent with the specification. Reusing tested AoN parsers as legacy regression coverage is appropriate. Their tests do not establish d20PFSRD compatibility or source eligibility.

The largest unresolved issue is integration: the existing application consumes generated JSON from a local SQLite pipeline, whereas the specification requests persistent ingestion jobs, administrative review, and controlled promotion. The holding implementation is a useful foundation but cannot, by itself, satisfy the complete application workflow.

Continue implementation on requirements already settled by the user. Do not treat every engineering safeguard as requiring another approval. Conversely, do not let changes in the new pipeline silently alter existing catalogue behavior.

## Decisions by review row

“Proceed” below means consistent with the existing specification, not additional authorization from this reviewer. Where a row combines new implementation with a legacy transition, those have different approval requirements.

| Row                                       | Design recommendation                                                                                                                                                                                                                                                                    | User decision or evidence still required                                                                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R01 — AoN authority**                   | Proceed with eligible d20PFSRD as the new spell baseline. Retain AoN adapters for regression tests and eligible enrichment. Do not automatically replace an existing spell merely because the baseline source changes.                                                                   | Review specific AoN correction-authority rules and any legacy identity mappings that are ambiguous or change effective rules. Resolve the reported absence of the historical d20PFSRD importer if another checkout or data source becomes available. |
| **R02 — Armor of Darkness override**      | Exclude the name-only override from the new pipeline. Preserve it in the discrepancy report with before/after class-access implications. Do not invent a replacement value.                                                                                                              | The user must decide whether to retain, replace, or remove the existing override after publication/version and errata evidence are presented.                                                                                                        |
| **R03 — Feature-name inference**          | Do not migrate regex-derived levels as authoritative source facts. Keep this outside the first spell implementation and label existing inferred contributions for the broader audit.                                                                                                     | Review each inference rule or clearly equivalent group. Class-specific evidence is necessary; approval of one pattern does not approve all feature inference.                                                                                        |
| **R04 — Identity and replacement**        | Proceed with separate source identity, canonical identity, and field-level merge plans. Eliminate whole-record replacement in the new path. A source identifier must include a source namespace and, where needed, an entry identifier within a page.                                    | Review ambiguous legacy mappings and proposed consolidation. Preserve existing IDs unless an explicitly reviewed transition provides aliases and verified reference updates.                                                                         |
| **R05 — First-match deduplication**       | Reject import order as a correctness rule. Produce collision groups showing every candidate, provenance, field conflict, and existing reference. Ensure downstream registry construction cannot undo the new matching policy.                                                            | Review the legacy export transition and groups with uncertain identity or materially conflicting values. Straightforward new-job duplicate prevention is already required.                                                                           |
| **R06 — Cache retention**                 | Proceed with bounded retention, content hashes, parser/normalizer versions, and an explicit reprocessing mechanism. Unknown material may reside in a restricted holding area pending classification; it must not become approved catalogue data.                                         | Establish the inventory and environment of legacy caches before retirement. Confirmed excluded staging content is already subject to the user’s purge instruction; uncertain ownership or classification needs review.                               |
| **R07 — Fetch controls**                  | Proceed with scoped fetching, robots handling, bounded requests, redirect checks, and protection against DNS rebinding. Serial requests are a reasonable initial default. DNS pinning is an implementation option, not the design requirement itself; preserve correct TLS verification. | No new policy approval is needed for these safeguards. Disabling or replacing the legacy operational entry point belongs in the transition review.                                                                                                   |
| **R08 — Parser repairs and fallbacks**    | Preserve source text and separate target, effect, and area. Label URL-derived names as provisional. Distinguish harmless normalization of layout whitespace from repairs that alter meaning or conceal malformed content.                                                                | Review substantive repair/fallback rules before carrying them forward. Mechanical normalization that demonstrably preserves meaning can proceed with fixtures.                                                                                       |
| **R09 — Missing exported fields**         | Proceed with additive support for casting details using compatible types. Verify that the adapter, holding schema, promotion path, export, and UI all preserve these fields end to end.                                                                                                  | Review the switch affecting existing runtime assets and records. Adding tested schema/interface support without changing catalogue content can proceed.                                                                                              |
| **R10 — Class-level qualifiers**          | Preserve raw class-level text, qualifiers, and unmatched segments. A partial parse must produce an explicit warning rather than silently narrow class access.                                                                                                                            | Review cases where reprocessing changes existing class access. Do not require a new policy decision merely to stop dropping information in new records.                                                                                              |
| **R11 — Defaults and derived automation** | Keep inferred values distinct from source facts. Audit them across existing entity types, while limiting new parser implementation to spells. Trace excluded source contributions into derived data before cleanup.                                                                      | The user must decide which legacy rules remain supported automation. Removing a derived modifier can change gameplay even when the source text is removed correctly.                                                                                 |
| **R12 — Eligibility labels**              | Reject `prdofficial`, `owner-approved`, and domain identity as sufficient eligibility evidence. Apply evidence-based classification and the precise Savage Co exception. Unknown AoN content is not automatically non-OGL.                                                               | Review specific publications and unresolved evidence. Confirm that “Savage Company” in the packet identifies the user’s intended “Savage Co” material; do not expand the exception to related publishers or works by inference.                      |
| **R13 — Automatic export**                | Proceed with a new path where fetching never mutates runtime exports. Promotion and export must be explicit, authorized operations against reviewed data.                                                                                                                                | Review retirement of legacy automatic export and the consumer cutover. A production deployment must not accidentally bundle modified catalogue assets before that transition is authorized.                                                          |
| **R14 — Catalogue administrator**         | Recommend an explicit server-controlled catalogue permission. Campaign GM status must not imply catalogue administration. Implement authorization boundaries and tests with no automatic account provisioning.                                                                           | The user must identify who receives access and approve the provisioning mechanism. Do not deploy a client-only role flag or depend solely on hiding UI controls.                                                                                     |
| **R15 — Retained copies**                 | Inventory the reported dump, assets, caches, manuscripts, and curated equipment by origin and environment. Rebuild affected staging artifacts and test cache invalidation. Preserve user-authored data and reference continuity.                                                         | Ambiguous file ownership, manuscript eligibility, and actions outside confirmed staging need resolution. Offline or external copies must be reported separately; central cache invalidation does not prove their deletion.                           |
| **R16 — AI**                              | Proceed with a deterministic core and disabled exception interface. Preserve the specified evidence, validation, review, usage-budget, and audit contracts in that interface. No new paid integration is necessary.                                                                      | No decision is currently needed to keep runtime AI disabled. Any subsequently discovered AI integration requires audit; selecting and enabling a new paid provider requires separate authority.                                                      |

## Additional conflicts and omissions to resolve

### A. The blanket approval gate is too broad

The packet says every row requires both user and Astra approval, including safeguards and requirements the user already specified.

Replace this with a decision log that distinguishes:

- Already specified requirements that may proceed.
- Implementation choices within those requirements.
- Additional or conflicting legacy behavior awaiting review.
- Evidence-dependent data classifications.
- Environment or access blockers.
- Deployment and production actions outside current scope.

Rows should be split where necessary. Record actual user decisions separately from this review. Silence, tests passing, and this recommendation do not constitute user approval.

### B. The promotion and runtime-consumption contract is missing

Specify how an approved holding record becomes visible to the existing JSON-consuming application.

A reasonable first design is:

1. Review a particular candidate revision.
2. Apply its approved changes to canonical staging data transactionally.
3. Generate a versioned runtime export from approved canonical data only.
4. Validate record IDs, references, fields, and exclusions.
5. Activate that export in staging and verify application behavior.

The exact storage and worker choices should follow repository constraints. Do not require a complete application migration to Supabase solely to add ingestion, but do not claim that an isolated local CLI fulfills the requested integrated administrative workflow.

### C. Approval must bind to the reviewed data

A reviewer’s approval must identify the candidate payload revision, existing canonical revision, and applicable eligibility/precedence policy versions.

If any of these changes before promotion, revalidate and require renewed review where the reviewed outcome changes. Promotion must not apply a stale merge plan over a newer manual edit.

Database constraints alone prevent some duplicates; they do not prevent lost updates or stale approval.

### D. Quarantine must affect runtime visibility

A database status is insufficient if the same unknown or excluded record remains in a generated pack, registry, search index, or browser cache.

Define quarantine enforcement across all staging consumers. Preserve references through an appropriate unavailable-record representation where needed. The production impact belongs in the production plan; do not change production during this work.

### E. Parser success is not publication eligibility

Specify which warnings block promotion and which are informational. Track validation, completeness, identity confidence, and eligibility separately.

The baseline source does not automatically establish eligibility, and a complete parse does not authorize publication. Unknown eligibility must block approved-catalogue promotion.

The packet’s external legal references should be treated as evidence to evaluate, not a legal determination independently verified by this review.

### F. Errata needs an explicit precedence record

For an approved correction, retain eligible evidence identifying:

- Entity and applicable version.
- Corrected field.
- Baseline and corrected values.
- Authority and evidence reference.
- Approval and precedence rule.
- Withdrawal or supersession status.

Missing legacy identity should block automatic cross-source merging, but need not block storage of a quarantined candidate or a human-assisted identity resolution.

An exact match to an already-reviewed identity mapping should not require reconstructing that decision on every refresh.

### G. Cleanup requires contribution lineage and a verification manifest

Record which canonical fields and derived artifacts depend on each imported contribution. Otherwise mixed-record cleanup cannot reliably identify what must be removed or recomputed.

The staging cleanup report should identify affected stores, performed actions, reference checks, verification results, and inaccessible copies. Use minimal identifiers/hashes where appropriate; do not retain forbidden text in purge logs.

Keep recoverable history for eligible duplicate consolidation separate from excluded-content purging. Recovery snapshots must not become a way to retain the content being purged.

### H. Access blockers are not design approvals

The packet reports no staging credentials and no running local Docker environment. Consequently:

- Hosted integration behavior is unverified.
- Repository project IDs are not live target verification.
- No staging purge has been demonstrated.
- Existing test success is not evidence of the new adapter or promotion path working.

Continue fixture tests, implementation, and integration preparation. Report the precise remaining access requirement when hosted verification becomes necessary. Do not mark those checks passed.

## Recommended next steps

Continue the isolated d20PFSRD spell adapter, holding records, validation, identity model, safe fetcher, exception interface, and meaningful tests.

Prepare the missing promotion/export architecture and the user decision packet for legacy rules, correction authority, catalogue administration, and uncertain source classifications.

Keep legacy runtime exports unchanged until the reviewed transition is ready. Complete the authorized staging cleanup only after classification and live target verification.

This review supplies design recommendations. It does not approve unresolved user choices, confirm Astra task identity, authorize production changes, or establish that the implementation is complete.
:::
