import { readFile } from "node:fs/promises";

const migrationPath =
  "supabase/migrations/20260804031842_initial_gameplay_schema.sql";
const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

const tables = [
  "profiles",
  "characters",
  "campaigns",
  "campaign_members",
  "campaign_characters",
  "campaign_invites",
  "character_runtime_states",
  "campaign_effects",
  "campaign_events",
];

const missing = [];
const authSql = (
  await readFile(
    "supabase/migrations/20260905040000_require_permanent_accounts.sql",
    "utf8",
  )
).toLowerCase();
const campaignJoinSql = (
  await readFile(
    "supabase/migrations/20260905043000_add_reusable_campaign_join_codes.sql",
    "utf8",
  )
).toLowerCase();
const campaignDeactivateSql = (
  await readFile(
    "supabase/migrations/20260905044000_end_access_for_inactive_campaigns.sql",
    "utf8",
  )
).toLowerCase();
for (const fragment of [
  "as restrictive for all to authenticated",
  "is_anonymous",
  "is false",
  "before update on public.character_runtime_states",
]) {
  if (!authSql.includes(fragment))
    missing.push(`Permanent-account contract: ${fragment}`);
}
for (const fragment of [
  "create or replace function public.is_campaign_member",
  "campaign.archived_at is null",
  "create function public.deactivate_campaign",
  "only an active campaign gm",
]) {
  if (!campaignDeactivateSql.includes(fragment)) {
    missing.push(`Inactive campaign contract: ${fragment}`);
  }
}
for (const table of tables) {
  if (!authSql.includes(`'${table}'`))
    missing.push(`Permanent-account restriction on ${table}`);
}
for (const table of tables) {
  if (!sql.includes(`create table public.${table}`)) {
    missing.push(`table public.${table}`);
  }
  if (!sql.includes(`alter table public.${table} enable row level security`)) {
    missing.push(`RLS on public.${table}`);
  }
}

const requiredFragments = [
  "create function public.is_campaign_member",
  "create function public.is_campaign_gm",
  "create policy characters_update_own",
  "create policy campaign_characters_insert_owner",
  "create policy campaign_invites_select_gm",
  "create policy runtime_states_select_authorized",
  "alter publication supabase_realtime add table public.character_runtime_states",
  "code_hash text not null unique",
];
for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) missing.push(fragment);
}
for (const fragment of [
  "add column join_code",
  "create function public.preview_campaign_by_code",
  "create function public.create_campaign_with_characters",
  "create function public.join_campaign_by_code",
  "for update",
  "c.owner_id = auth.uid()",
  "c.archived_at is null",
]) {
  if (!campaignJoinSql.includes(fragment)) {
    missing.push(`Reusable campaign ID contract: ${fragment}`);
  }
}

if (missing.length) {
  console.error("Backend schema contract is incomplete:");
  missing.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

console.log(
  `Backend schema contract verified: ${tables.length} RLS-protected tables.`,
);
