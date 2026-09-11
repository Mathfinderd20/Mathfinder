-- Extend the existing creation-rule document without changing campaign authority.
create or replace function public.valid_campaign_creation_rules(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) <> 'object' then return false; end if;
  if not value ?& array['startingLevel','method','pointBuyBudget','abilityArray','buildGuide']
    or exists (select from jsonb_object_keys(value) k where k not in
      ('startingLevel','method','pointBuyBudget','abilityArray','buildGuide','campaignTraitLimit','campaignTraitOptions')) then
    return false;
  end if;
  if jsonb_typeof(value->'startingLevel') <> 'number'
    or jsonb_typeof(value->'pointBuyBudget') <> 'number'
    or (value->>'startingLevel') !~ '^[0-9]+$'
    or (value->>'pointBuyBudget') !~ '^[0-9]+$'
    or (value->>'startingLevel')::numeric not between 1 and 20
    or (value->>'pointBuyBudget')::numeric not between 0 and 102
    or jsonb_typeof(value->'method') <> 'string'
    or (value->>'method') not in ('manual','point-buy','array')
    or jsonb_typeof(value->'buildGuide') <> 'string'
    or length(value->>'buildGuide') > 5000
    or jsonb_typeof(value->'abilityArray') <> 'array' then return false; end if;
  if jsonb_array_length(value->'abilityArray') <> 6 then return false; end if;
  for item in select * from jsonb_array_elements(value->'abilityArray') loop
    if jsonb_typeof(item) <> 'number' or item::text !~ '^[0-9]+$'
      or item::text::numeric not between 7 and 18 then return false; end if;
  end loop;
  if value ? 'campaignTraitLimit' then
    if jsonb_typeof(value->'campaignTraitLimit') <> 'number'
      or (value->>'campaignTraitLimit') !~ '^[0-9]+$'
      or (value->>'campaignTraitLimit')::numeric not between 0 and 3 then return false; end if;
  end if;
  if value ? 'campaignTraitOptions' then
    if jsonb_typeof(value->'campaignTraitOptions') <> 'array' then return false; end if;
    for item in select * from jsonb_array_elements(value->'campaignTraitOptions') loop
      if jsonb_typeof(item) <> 'string' or length(btrim(item #>> '{}')) = 0
        or length(item #>> '{}') > 200 then return false; end if;
    end loop;
    if (select count(*) <> count(distinct lower(btrim(v)))
      from jsonb_array_elements_text(value->'campaignTraitOptions') as options(v)) then
      return false;
    end if;
  end if;
  return true;
exception when others then return false;
end;
$$;

create or replace function public.set_campaign_creation_rules(p_campaign_id uuid, p_rules jsonb)
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
  update public.campaigns set creation_rules = p_rules where id = p_campaign_id;
end;
$$;
