-- Mathfinder shared gameplay schema.
-- Rules/content ingestion remains in packages/content-db SQLite; this database
-- stores identities, player-owned builds, campaigns, and live campaign state.

create extension if not exists pgcrypto;

create type public.campaign_role as enum ('gm', 'player');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique check (handle is null or length(trim(handle)) between 3 and 40),
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  ancestry_name text not null default '',
  class_summary text not null default '',
  level integer not null default 1 check (level between 1 and 20),
  build jsonb not null check (jsonb_typeof(build) = 'object'),
  build_version integer not null default 1 check (build_version > 0),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index characters_owner_updated_idx
  on public.characters (owner_id, updated_at desc)
  where archived_at is null;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 100),
  description text check (description is null or length(description) <= 2000),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index campaigns_owner_updated_idx
  on public.campaigns (owner_id, updated_at desc)
  where archived_at is null;

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.campaign_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_idx
  on public.campaign_members (user_id, campaign_id);

create table public.campaign_characters (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (campaign_id, character_id)
);

create index campaign_characters_character_idx
  on public.campaign_characters (character_id, campaign_id);

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  code_hash text not null unique,
  role public.campaign_role not null default 'player',
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (max_uses is null or use_count <= max_uses)
);

create index campaign_invites_campaign_idx
  on public.campaign_invites (campaign_id, created_at desc);

create table public.character_runtime_states (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  state_version integer not null default 1 check (state_version > 0),
  revision integer not null default 1 check (revision > 0),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create unique index character_runtime_campaign_unique
  on public.character_runtime_states (character_id, campaign_id)
  where campaign_id is not null;

create unique index character_runtime_solo_unique
  on public.character_runtime_states (character_id)
  where campaign_id is null;

create table public.campaign_effects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  source_character_id uuid references public.characters (id) on delete set null,
  effect_key text not null check (length(trim(effect_key)) between 1 and 120),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index campaign_effects_active_idx
  on public.campaign_effects (campaign_id, created_at desc)
  where active;

create table public.campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null check (length(trim(event_type)) between 1 and 100),
  subject_type text not null check (length(trim(subject_type)) between 1 and 100),
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index campaign_events_campaign_created_idx
  on public.campaign_events (campaign_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        split_part(coalesce(new.email, 'Adventurer'), '@', 1)
      ),
      100
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_user();

create function public.create_campaign_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role)
  values (new.id, new.owner_id, 'gm')
  on conflict (campaign_id, user_id)
  do update set role = 'gm';
  return new;
end;
$$;

create trigger campaigns_create_owner_membership
after insert on public.campaigns
for each row execute function public.create_campaign_owner_membership();

create function public.is_campaign_member(
  target_campaign_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members
    where campaign_id = target_campaign_id
      and user_id = target_user_id
  );
$$;

create function public.is_campaign_gm(
  target_campaign_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members
    where campaign_id = target_campaign_id
      and user_id = target_user_id
      and role = 'gm'
  );
$$;

create function public.shares_campaign_with(
  target_user_id uuid,
  viewer_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.campaign_members viewer
    join public.campaign_members target
      on target.campaign_id = viewer.campaign_id
    where viewer.user_id = viewer_user_id
      and target.user_id = target_user_id
  );
$$;

revoke all on function public.is_campaign_member(uuid, uuid) from public;
revoke all on function public.is_campaign_gm(uuid, uuid) from public;
revoke all on function public.shares_campaign_with(uuid, uuid) from public;
grant execute on function public.is_campaign_member(uuid, uuid) to authenticated;
grant execute on function public.is_campaign_gm(uuid, uuid) to authenticated;
grant execute on function public.shares_campaign_with(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_characters enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.character_runtime_states enable row level security;
alter table public.campaign_effects enable row level security;
alter table public.campaign_events enable row level security;

create policy profiles_select_shared
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or public.shares_campaign_with(id)
);

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy characters_select_authorized
on public.characters for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.campaign_characters assignment
    where assignment.character_id = characters.id
      and public.is_campaign_member(assignment.campaign_id)
  )
);

create policy characters_insert_own
on public.characters for insert
to authenticated
with check (owner_id = auth.uid());

create policy characters_update_own
on public.characters for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy characters_delete_own
on public.characters for delete
to authenticated
using (owner_id = auth.uid());

create policy campaigns_select_member
on public.campaigns for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_campaign_member(id)
);

create policy campaigns_insert_own
on public.campaigns for insert
to authenticated
with check (owner_id = auth.uid());

create policy campaigns_update_gm
on public.campaigns for update
to authenticated
using (owner_id = auth.uid() or public.is_campaign_gm(id))
with check (owner_id = auth.uid() or public.is_campaign_gm(id));

create policy campaigns_delete_owner
on public.campaigns for delete
to authenticated
using (owner_id = auth.uid());

create policy campaign_members_select_member
on public.campaign_members for select
to authenticated
using (public.is_campaign_member(campaign_id));

create policy campaign_members_update_gm
on public.campaign_members for update
to authenticated
using (public.is_campaign_gm(campaign_id))
with check (public.is_campaign_gm(campaign_id));

create policy campaign_members_delete_self_or_gm
on public.campaign_members for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_campaign_gm(campaign_id)
);

create policy campaign_characters_select_authorized
on public.campaign_characters for select
to authenticated
using (
  public.is_campaign_member(campaign_id)
  or exists (
    select 1 from public.characters
    where characters.id = campaign_characters.character_id
      and characters.owner_id = auth.uid()
  )
);

create policy campaign_characters_insert_owner
on public.campaign_characters for insert
to authenticated
with check (
  assigned_by = auth.uid()
  and public.is_campaign_member(campaign_id)
  and exists (
    select 1 from public.characters
    where characters.id = campaign_characters.character_id
      and characters.owner_id = auth.uid()
  )
);

create policy campaign_characters_delete_owner_or_gm
on public.campaign_characters for delete
to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or exists (
    select 1 from public.characters
    where characters.id = campaign_characters.character_id
      and characters.owner_id = auth.uid()
  )
);

create policy campaign_invites_select_gm
on public.campaign_invites for select
to authenticated
using (public.is_campaign_gm(campaign_id));

create policy campaign_invites_insert_gm
on public.campaign_invites for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_campaign_gm(campaign_id)
);

create policy campaign_invites_update_gm
on public.campaign_invites for update
to authenticated
using (public.is_campaign_gm(campaign_id))
with check (public.is_campaign_gm(campaign_id));

create policy runtime_states_select_authorized
on public.character_runtime_states for select
to authenticated
using (
  exists (
    select 1 from public.characters
    where characters.id = character_runtime_states.character_id
      and characters.owner_id = auth.uid()
  )
  or (
    campaign_id is not null
    and public.is_campaign_member(campaign_id)
    and exists (
      select 1 from public.campaign_characters
      where campaign_characters.campaign_id = character_runtime_states.campaign_id
        and campaign_characters.character_id = character_runtime_states.character_id
    )
  )
);

create policy runtime_states_insert_owner
on public.character_runtime_states for insert
to authenticated
with check (
  updated_by = auth.uid()
  and exists (
    select 1 from public.characters
    where characters.id = character_runtime_states.character_id
      and characters.owner_id = auth.uid()
  )
);

create policy runtime_states_update_owner
on public.character_runtime_states for update
to authenticated
using (
  exists (
    select 1 from public.characters
    where characters.id = character_runtime_states.character_id
      and characters.owner_id = auth.uid()
  )
)
with check (
  updated_by = auth.uid()
  and exists (
    select 1 from public.characters
    where characters.id = character_runtime_states.character_id
      and characters.owner_id = auth.uid()
  )
);

create policy campaign_effects_select_member
on public.campaign_effects for select
to authenticated
using (public.is_campaign_member(campaign_id));

create policy campaign_effects_insert_gm
on public.campaign_effects for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_campaign_gm(campaign_id)
);

create policy campaign_effects_update_gm
on public.campaign_effects for update
to authenticated
using (public.is_campaign_gm(campaign_id))
with check (public.is_campaign_gm(campaign_id));

create policy campaign_events_select_member
on public.campaign_events for select
to authenticated
using (public.is_campaign_member(campaign_id));

create policy campaign_events_insert_actor
on public.campaign_events for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.is_campaign_member(campaign_id)
);

-- RLS controls rows; column grants prevent authorized rows from being used to
-- rewrite ownership or relationship keys. Trusted ownership/invite workflows
-- can still use future SECURITY DEFINER functions.
revoke update on public.profiles from authenticated;
grant update (handle, display_name, avatar_url) on public.profiles to authenticated;

revoke update on public.characters from authenticated;
grant update (
  name,
  ancestry_name,
  class_summary,
  level,
  build,
  build_version,
  revision,
  archived_at
) on public.characters to authenticated;

revoke update on public.campaigns from authenticated;
grant update (name, description, revision, archived_at)
  on public.campaigns to authenticated;

revoke update on public.campaign_invites from authenticated;
grant update (expires_at, max_uses, revoked_at)
  on public.campaign_invites to authenticated;

revoke update on public.character_runtime_states from authenticated;
grant update (state, state_version, revision, updated_by)
  on public.character_runtime_states to authenticated;

revoke update on public.campaign_effects from authenticated;
grant update (payload, active, expires_at)
  on public.campaign_effects to authenticated;

alter publication supabase_realtime add table public.character_runtime_states;
alter publication supabase_realtime add table public.campaign_effects;
alter publication supabase_realtime add table public.campaign_events;
