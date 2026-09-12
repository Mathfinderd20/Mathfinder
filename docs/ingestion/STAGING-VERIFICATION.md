# Hosted staging evidence

Verified through the authenticated Supabase dashboard on 2026-09-11 UTC.

- Project display name: `DIreSheets Staging`, organization `D&D Gents Org`.
- Project reference and displayed API URL: `pkupqzdnefnjwndwzhdr`, `https://pkupqzdnefnjwndwzhdr.supabase.co`.
- Dashboard links and SQL operations remained scoped to this project. Supabase labels its main database branch “Production”; this is the main branch of the separately identified staging project, not the application's production project `guronltdufvmnwnjqggd`.
- Browser dashboard access works. CLI authentication still reports no access token; these are separate sessions.
- Subsequent Cloudflare inspection independently verified that the actual `mathfinder-stage` build has `VITE_APP_ENV=staging` and the exact `pkupqzdnefnjwndwzhdr` Supabase URL. Its custom domain is `stage.diresheets.com`; see `CLOUDFLARE-VERIFICATION.md`.
- Ten public tables were visible: campaign_characters, campaign_effects, campaign_events, campaign_invites, campaign_members, campaign_workspaces, campaigns, character_runtime_states, characters, profiles. No hosted catalogue/ingestion table was found in the public schema.

Read-only aggregate inventory:

| Object                   | Rows |
| ------------------------ | ---: |
| characters               |    7 |
| character_runtime_states |    1 |
| campaigns                |    0 |
| campaign_workspaces      |    0 |
| campaign_effects         |    0 |
| campaign_events          |    0 |
| profiles                 |    4 |
| storage.objects          |    0 |

Further aggregate checks: three characters have a `spellLibrary` field, two have `spellSelections`, and one has nonempty equipment. No profiles have nonempty saved build slots. All ten public tables have RLS enabled; 38 public policies exist. These counts confirm policy presence, not full policy correctness or API authorization behavior. Exactly one catalogue administrator exists after the authorized grant.

R17 class-impact query: among the five classes changed by `completeCoreSpellProgression`, staging has one character with one saved Druid level and one character with one saved Sorcerer level. No saved Cleric, Paladin or Ranger level matched. These are per-class aggregate counts; they do not prove distinct characters across classes, validate class identity, or measure resulting slot differences. No character content was changed.

The single runtime-state row contains private character details, collections, events, flags, histories, ledgers, resources, slotUsage and toggles. Only JSON field names were inspected; private notes and campaign/user payloads were not copied into this report. Character build fields include equipment and levels. Counts do not establish whether individual embedded values are imported or user-authored.

## Authorized permission change

The user approved server-controlled `app_metadata.catalogue_role = admin` and explicitly identified their staging sign-in account. An exact account lookup returned one confirmed, nonanonymous user with no existing catalogue role. A single scoped update added `catalogue_role=admin`, preserving all other app metadata. Its returned row verified the new permission. No other account was provisioned. The account's email is intentionally omitted from repository documentation.

Evidence references for deployment configuration:

- Target verification: `STAGING-VERIFICATION-20260911-dashboard` (verifies Supabase, not a future worker disk volume).
- Permission approval: `R14-user-approval-20260911`.

These references do not authorize unresolved catalogue transitions, source classifications, or production operations. No catalogue import, content purge, worker deployment, or Supabase schema migration has been executed. The only hosted write so far is the explicitly authorized staging account permission.
