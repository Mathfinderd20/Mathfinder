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

if (missing.length) {
  console.error("Backend schema contract is incomplete:");
  missing.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

console.log(
  `Backend schema contract verified: ${tables.length} RLS-protected tables.`,
);
