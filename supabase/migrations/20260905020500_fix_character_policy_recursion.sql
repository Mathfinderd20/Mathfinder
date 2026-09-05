create function public.owns_character(
  target_character_id uuid,
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
    from public.characters
    where id = target_character_id
      and owner_id = target_user_id
  );
$$;

revoke all on function public.owns_character(uuid, uuid) from public;
grant execute on function public.owns_character(uuid, uuid) to authenticated;

drop policy campaign_characters_select_authorized
  on public.campaign_characters;
create policy campaign_characters_select_authorized
on public.campaign_characters for select
to authenticated
using (
  public.is_campaign_member(campaign_id)
  or public.owns_character(character_id)
);

drop policy campaign_characters_insert_owner
  on public.campaign_characters;
create policy campaign_characters_insert_owner
on public.campaign_characters for insert
to authenticated
with check (
  assigned_by = auth.uid()
  and public.is_campaign_member(campaign_id)
  and public.owns_character(character_id)
);

drop policy campaign_characters_delete_owner_or_gm
  on public.campaign_characters;
create policy campaign_characters_delete_owner_or_gm
on public.campaign_characters for delete
to authenticated
using (
  public.is_campaign_gm(campaign_id)
  or public.owns_character(character_id)
);
