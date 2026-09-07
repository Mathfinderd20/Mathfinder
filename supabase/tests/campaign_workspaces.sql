-- Transaction-only regression tests. No test rows survive.
begin;
insert into auth.users(id, email, is_anonymous) values
('11111111-1111-4111-8111-111111111111', 'workspace-owner@example.invalid', false),
('22222222-2222-4222-8222-222222222222', 'workspace-player@example.invalid', false);
insert into public.campaigns(id, owner_id, name) values
('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Workspace regression A'),
('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'Workspace regression B');
insert into public.campaign_members(campaign_id,user_id,role)
values ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','gm');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}',true);
do $$
begin
  if public.save_campaign_workspace('33333333-3333-4333-8333-333333333333',0,'{"notes":[{"body":"private"}]}') <> 1 then raise exception 'Insert revision failed'; end if;
  if public.save_campaign_workspace('33333333-3333-4333-8333-333333333333',1,'{"notes":[{"body":"updated"}]}') <> 2 then raise exception 'Update revision failed'; end if;
  perform public.save_campaign_workspace('44444444-4444-4444-8444-444444444444',0,'{"notes":[]}');
  if (select state->'notes' from public.campaign_workspaces where campaign_id='44444444-4444-4444-8444-444444444444') <> '[]'::jsonb then raise exception 'Campaign isolation failed'; end if;
  begin
    perform public.save_campaign_workspace('33333333-3333-4333-8333-333333333333',1,'{}');
    raise exception 'Stale save accepted';
  exception when raise_exception then
    if sqlerrm not like 'Workspace changed%' then raise; end if;
  end;
  begin
    update public.campaign_workspaces set state='{}';
    raise exception 'Direct write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","is_anonymous":false}',true);
do $$
begin
  if exists(select 1 from public.campaign_workspaces where campaign_id='33333333-3333-4333-8333-333333333333') then raise exception 'Other GM read private state'; end if;
  begin
    perform public.save_campaign_workspace('33333333-3333-4333-8333-333333333333',2,'{}');
    raise exception 'Other GM wrote private state';
  exception when raise_exception then
    if sqlerrm not like 'Only the active campaign creator%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":true}',true);
do $$
begin
  if exists(select 1 from public.campaign_workspaces where campaign_id='33333333-3333-4333-8333-333333333333') then raise exception 'Anonymous read allowed'; end if;
  begin
    perform public.save_campaign_workspace('33333333-3333-4333-8333-333333333333',2,'{}');
    raise exception 'Anonymous write allowed';
  exception when raise_exception then
    if sqlerrm not like 'A permanent account%' then raise; end if;
  end;
end $$;
reset role;
update public.campaigns set archived_at=now() where id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","is_anonymous":false}',true);
do $$
begin
  if exists(select 1 from public.campaign_workspaces where campaign_id='33333333-3333-4333-8333-333333333333') then raise exception 'Inactive campaign readable'; end if;
  begin
    perform public.save_campaign_workspace('33333333-3333-4333-8333-333333333333',2,'{}');
    raise exception 'Inactive campaign writable';
  exception when raise_exception then
    if sqlerrm not like 'Only the active campaign creator%' then raise; end if;
  end;
end $$;
rollback;
select 'Workspace security, persistence, concurrency and isolation passed' as result;
