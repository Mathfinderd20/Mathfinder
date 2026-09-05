-- Reusable, player-facing campaign IDs. The UUID remains the relational key;
-- join_code is a high-entropy bearer code that is easier to share and type.

create function public.generate_campaign_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select upper(encode(extensions.gen_random_bytes(10), 'hex'));
$$;

revoke all on function public.generate_campaign_join_code() from public;
grant execute on function public.generate_campaign_join_code() to authenticated;

alter table public.campaigns
  add column join_code text not null default public.generate_campaign_join_code(),
  add constraint campaigns_join_code_format
    check (join_code ~ '^[0-9A-F]{20}$'),
  add constraint campaigns_join_code_key unique (join_code);

create function public.normalize_campaign_join_code(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(value, ''), '[^0-9a-fA-F]', '', 'g'));
$$;

revoke all on function public.normalize_campaign_join_code(text) from public;

create function public.preview_campaign_by_code(p_code text)
returns table (
  campaign_id uuid,
  campaign_name text,
  campaign_description text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'A permanent account is required.' using errcode = '42501';
  end if;

  return query
  select c.id, c.name, c.description
  from public.campaigns c
  where c.join_code = public.normalize_campaign_join_code(p_code)
    and c.archived_at is null;
end;
$$;

create function public.create_campaign_with_characters(
  p_name text,
  p_description text default null,
  p_character_ids uuid[] default '{}'::uuid[]
)
returns table (campaign_id uuid, join_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.campaigns;
  requested_count integer;
  owned_count integer;
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'A permanent account is required.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 100 then
    raise exception 'Campaign name must be between 1 and 100 characters.';
  end if;
  if p_description is not null and length(p_description) > 2000 then
    raise exception 'Campaign description cannot exceed 2000 characters.';
  end if;

  select count(*) into requested_count
  from (select distinct unnest(coalesce(p_character_ids, '{}'::uuid[]))) ids;
  select count(*) into owned_count
  from public.characters c
  where c.id = any(coalesce(p_character_ids, '{}'::uuid[]))
    and c.owner_id = auth.uid()
    and c.archived_at is null;
  if requested_count <> owned_count then
    raise exception 'One or more selected characters are unavailable.'
      using errcode = '42501';
  end if;

  insert into public.campaigns (owner_id, name, description)
  values (auth.uid(), trim(p_name), nullif(trim(coalesce(p_description, '')), ''))
  returning * into created;

  insert into public.campaign_characters (campaign_id, character_id, assigned_by)
  select created.id, id, auth.uid()
  from (select distinct unnest(coalesce(p_character_ids, '{}'::uuid[])) as id) ids;

  return query select created.id, created.join_code;
end;
$$;

create function public.join_campaign_by_code(
  p_code text,
  p_character_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_campaign_id uuid;
  requested_count integer;
  owned_count integer;
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'A permanent account is required.' using errcode = '42501';
  end if;

  select c.id into target_campaign_id
  from public.campaigns c
  where c.join_code = public.normalize_campaign_join_code(p_code)
    and c.archived_at is null
  for update;
  if target_campaign_id is null then
    raise exception 'Campaign ID is invalid or the campaign is inactive.';
  end if;

  select count(*) into requested_count
  from (select distinct unnest(coalesce(p_character_ids, '{}'::uuid[]))) ids;
  if requested_count = 0 then
    raise exception 'Select at least one character.';
  end if;
  select count(*) into owned_count
  from public.characters c
  where c.id = any(coalesce(p_character_ids, '{}'::uuid[]))
    and c.owner_id = auth.uid()
    and c.archived_at is null;
  if requested_count <> owned_count then
    raise exception 'One or more selected characters are unavailable.'
      using errcode = '42501';
  end if;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (target_campaign_id, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing;

  insert into public.campaign_characters (campaign_id, character_id, assigned_by)
  select target_campaign_id, id, auth.uid()
  from (select distinct unnest(p_character_ids) as id) ids
  on conflict (campaign_id, character_id) do nothing;

  return target_campaign_id;
end;
$$;

revoke all on function public.preview_campaign_by_code(text) from public;
revoke all on function public.create_campaign_with_characters(text, text, uuid[]) from public;
revoke all on function public.join_campaign_by_code(text, uuid[]) from public;
grant execute on function public.preview_campaign_by_code(text) to authenticated;
grant execute on function public.create_campaign_with_characters(text, text, uuid[]) to authenticated;
grant execute on function public.join_campaign_by_code(text, uuid[]) to authenticated;
