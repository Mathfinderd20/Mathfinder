# Guided creation and advancement integration

Integrated against staging `0f57c95253621c0c24ab4d65bd083846051afec8`, including PRs #33–#36. The original local checkout is preserved; unrelated ingestion and spell-text changes are excluded.

## Combined behavior

- The eight-step creation guide and five-step advancement guide retain drafts until final confirmation. Higher-level campaign starts reuse advancement and save once at the target level.
- Favored-class details use the shared staging picker and persist with each level. Canonical language fields retain existing custom values.
- Full-list casters receive unlocked class spells automatically. Spellbook casters acquire spells explicitly, and spontaneous casters choose within their known-spell allowance. The effective library is separate from editable manual additions.
- One application helper handles explicit `library`, `known`, and `prepared` operations. It preserves existing choices, rejects excess selections instead of truncating them, and retains implicit spell ownership on older builds when first creating an explicit library record.
- Wizards receive their starting book on first entry into the class, including multiclass entry. Subsequent wizard levels require two distinct new spells across eligible spell levels. Acquisitions do not consume preparation slots. Starting rules for future non-wizard spellbook classes require explicit implementation.
- Preparation is optional during either guide. Cleric domains are collected on first entry and carried through the final update.
- Core class spellcasting definitions in the runtime asset were refreshed from source. All other asset content, including the imported catalog, is unchanged.

## Verification

- TypeScript checks and ESLint pass.
- All 565 tests pass: 21 content database, 5 rules data, 305 rules engine, and 234 web tests.
- Web production build passes using the same staging placeholder configuration as CI. Formatting, whitespace, runtime-content verification, and backend schema-contract checks pass.
- Browser checks used the actual guide components and runtime content in a temporary local fixture. They covered wizard creation (35 loaded cantrips and six level-one spells at INT 16), optional preparation, two-spell advancement, split-level grants, incomplete review gates, and cancellation. A level-two wizard creation saved once and retained its starting book, preparation, and language.
- First-time cleric multiclassing persisted two domains and a preparation without writing a manual class library. Sorcerer advancement retained existing known spells and added only the newly available allowance. A legacy language and unrelated purse data survived advancement.

## Campaign-trait migration release requirement

`20260911010000_guided_creation_traits.sql` extends the existing creation-rule validator and setter while retaining their authority checks. `supabase/tests/guided_creation_traits.sql` provides transaction-only regression coverage for legacy documents, boundaries, malformed values, duplicate traits, persistence, and access.

The prior and new migrations, followed by these tests, passed in an isolated PGlite PostgreSQL runtime with minimal auth/campaign fixtures. The full Supabase stack could not run because the local Docker daemon was unavailable. Hosted staging migration history and the migration against the complete staging schema still need verification before release. No hosted migration was applied by this integration.

Before deployment, check staging migration history, run the SQL regression against the complete migrated schema in an isolated environment, and apply the migration through the normal database deployment process. The new trait settings depend on this migration. This PR does not deploy or promote production.
