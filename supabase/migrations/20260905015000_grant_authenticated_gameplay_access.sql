-- RLS decides which rows an authenticated client may access. PostgreSQL table
-- grants are still required before those policies can be evaluated.

grant select, insert, delete on public.characters to authenticated;
grant select, insert, delete on public.campaigns to authenticated;

grant select, update, delete on public.campaign_members to authenticated;
grant select, insert, delete on public.campaign_characters to authenticated;

grant select, insert on public.campaign_invites to authenticated;
grant select, insert on public.character_runtime_states to authenticated;
grant select, insert on public.campaign_effects to authenticated;
grant select, insert on public.campaign_events to authenticated;

-- Column-scoped update grants are declared in the initial schema migration and
-- intentionally exclude ownership and relationship keys.
