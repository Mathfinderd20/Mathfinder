-- Existing anonymous development accounts must not access gameplay data.
-- Disabling new anonymous signups alone does not revoke their existing JWTs.
alter table public.profiles add column saved_build_slots jsonb not null default '[]'::jsonb
  check (jsonb_typeof(saved_build_slots) = 'array');
grant update (saved_build_slots) on public.profiles to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'characters', 'campaigns', 'campaign_members',
    'campaign_characters', 'campaign_invites', 'character_runtime_states',
    'campaign_effects', 'campaign_events'
  ] loop
    execute format(
      'create policy permanent_accounts_only on public.%I as restrictive for all to authenticated using ((auth.jwt()->>''is_anonymous'')::boolean is false) with check ((auth.jwt()->>''is_anonymous'')::boolean is false)',
      table_name
    );
  end loop;
end;
$$;

-- Runtime writes use updated_at as a concurrency token, just like builds.
create trigger runtime_set_updated_at
before update on public.character_runtime_states
for each row execute function public.set_updated_at();
