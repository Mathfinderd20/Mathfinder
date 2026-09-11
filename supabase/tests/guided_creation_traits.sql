-- Run after the guided-creation migration. All fixtures roll back.
begin;

do $$
declare
  legacy jsonb := '{"startingLevel":1,"method":"manual","pointBuyBudget":20,"abilityArray":[15,14,13,12,10,8],"buildGuide":"Guide"}';
  invalid jsonb;
begin
  if not public.valid_campaign_creation_rules(legacy)
    or not public.valid_campaign_creation_rules(null)
    or not public.valid_campaign_creation_rules(legacy || '{"campaignTraitLimit":0,"campaignTraitOptions":[]}')
    or not public.valid_campaign_creation_rules(legacy || '{"campaignTraitLimit":3,"campaignTraitOptions":["Local Hero","Scholar"]}') then
    raise exception 'Valid legacy or extended rules rejected';
  end if;
  for invalid in select value from jsonb_array_elements('[
    {"campaignTraitLimit":4}, {"campaignTraitLimit":-1}, {"campaignTraitLimit":1.5},
    {"campaignTraitLimit":"2"}, {"campaignTraitLimit":null},
    {"campaignTraitOptions":null}, {"campaignTraitOptions":"Hero"},
    {"campaignTraitOptions":[""]}, {"campaignTraitOptions":["   "]},
    {"campaignTraitOptions":[1]}, {"campaignTraitOptions":["Hero"," hero "]},
    {"unexpected":true}, {"startingLevel":0}, {"startingLevel":21},
    {"method":null}, {"abilityArray":[15,14]}, {"pointBuyBudget":null}
  ]') loop
    if public.valid_campaign_creation_rules(legacy || invalid) is distinct from false then
      raise exception 'Invalid creation rules accepted: %', invalid;
    end if;
  end loop;
  if public.valid_campaign_creation_rules(legacy - 'method') is distinct from false
    or public.valid_campaign_creation_rules('[]') is distinct from false
    or public.valid_campaign_creation_rules(legacy || jsonb_build_object('campaignTraitOptions',jsonb_build_array(repeat('x',201)))) is distinct from false then
    raise exception 'Malformed or oversized creation rules accepted';
  end if;
  if has_function_privilege('anon','public.set_campaign_creation_rules(uuid,jsonb)','EXECUTE')
    or not has_function_privilege('authenticated','public.set_campaign_creation_rules(uuid,jsonb)','EXECUTE') then
    raise exception 'Migration changed setter access';
  end if;
end $$;

insert into auth.users(id,email,is_anonymous) values
('55555555-5555-4555-8555-555555555555','guide-owner@example.invalid',false),
('66666666-6666-4666-8666-666666666666','guide-outsider@example.invalid',false);
insert into public.campaigns(id,owner_id,name) values
('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','Guided creation regression');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","is_anonymous":false}',true);
do $$
declare rules jsonb := '{"startingLevel":2,"method":"manual","pointBuyBudget":20,"abilityArray":[15,14,13,12,10,8],"buildGuide":"Guide","campaignTraitLimit":2,"campaignTraitOptions":["Local Hero","Scholar"]}';
begin
  perform public.set_campaign_creation_rules('77777777-7777-4777-8777-777777777777',rules);
  if (select creation_rules from public.campaigns where id='77777777-7777-4777-8777-777777777777') is distinct from rules then
    raise exception 'Setter dropped extended trait settings';
  end if;
end $$;

select set_config('request.jwt.claims','{"sub":"66666666-6666-4666-8666-666666666666","is_anonymous":false}',true);
do $$ begin
  begin
    perform public.set_campaign_creation_rules('77777777-7777-4777-8777-777777777777','{}');
    raise exception 'Outsider changed creation rules';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","is_anonymous":true}',true);
do $$ begin
  begin
    perform public.set_campaign_creation_rules('77777777-7777-4777-8777-777777777777','{}');
    raise exception 'Anonymous account changed creation rules';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
