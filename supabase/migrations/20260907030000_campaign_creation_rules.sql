-- Creation guidance is visible to members and permanent users with a join code.
-- Existing campaigns deliberately have no generation restrictions.
create function public.valid_campaign_creation_rules(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select value is null or coalesce((
    jsonb_typeof(value) = 'object'
    and (select count(*) from jsonb_object_keys(value)) = 5
    and value ?& array['startingLevel','method','pointBuyBudget','abilityArray','buildGuide']
    and jsonb_typeof(value->'startingLevel') = 'number'
    and jsonb_typeof(value->'pointBuyBudget') = 'number'
    and (value->>'startingLevel') ~ '^[0-9]+$'
    and (value->>'startingLevel')::numeric between 1 and 20
    and (value->>'method') in ('manual','point-buy','array')
    and (value->>'pointBuyBudget') ~ '^[0-9]+$'
    and (value->>'pointBuyBudget')::numeric between 0 and 102
    and jsonb_typeof(value->'buildGuide') = 'string'
    and length(value->>'buildGuide') <= 5000
    and jsonb_typeof(value->'abilityArray') = 'array'
    and jsonb_array_length(value->'abilityArray') = 6
    and not exists (
      select from jsonb_array_elements(value->'abilityArray') score
      where jsonb_typeof(score) <> 'number'
        or score::text !~ '^[0-9]+$'
        or score::text::numeric not between 7 and 18
    )
  ), false);
$$;

revoke all on function public.valid_campaign_creation_rules(jsonb) from public;
grant execute on function public.valid_campaign_creation_rules(jsonb) to authenticated, service_role;

alter table public.campaigns
  add column creation_rules jsonb,
  add constraint campaigns_creation_rules_valid
    check (public.valid_campaign_creation_rules(creation_rules));

create function public.set_campaign_creation_rules(p_campaign_id uuid, p_rules jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true)
    or not public.is_campaign_gm(p_campaign_id) then
    raise exception 'An active campaign GM is required.' using errcode = '42501';
  end if;
  if p_rules is null or not public.valid_campaign_creation_rules(p_rules) then
    raise exception 'Invalid creation rules.';
  end if;
  update public.campaigns set creation_rules = jsonb_build_object(
    'startingLevel', (p_rules->>'startingLevel')::integer,
    'method', p_rules->>'method',
    'pointBuyBudget', (p_rules->>'pointBuyBudget')::integer,
    'abilityArray', p_rules->'abilityArray',
    'buildGuide', p_rules->>'buildGuide'
  ) where id = p_campaign_id;
end;
$$;

create function public.preview_campaign_creation_rules(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'A permanent account is required.' using errcode = '42501';
  end if;
  return (select creation_rules from public.campaigns
    where join_code = public.normalize_campaign_join_code(p_code) and archived_at is null);
end;
$$;

revoke all on function public.set_campaign_creation_rules(uuid, jsonb) from public;
revoke all on function public.preview_campaign_creation_rules(text) from public;
grant execute on function public.set_campaign_creation_rules(uuid, jsonb) to authenticated;
grant execute on function public.preview_campaign_creation_rules(text) to authenticated;
