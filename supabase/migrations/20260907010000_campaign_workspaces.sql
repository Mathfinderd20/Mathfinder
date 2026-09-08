create table public.campaign_workspaces (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.campaign_workspaces enable row level security;
create policy permanent_accounts_only on public.campaign_workspaces as restrictive for all to authenticated
using ((auth.jwt()->>'is_anonymous')::boolean is false)
with check ((auth.jwt()->>'is_anonymous')::boolean is false);
create policy workspace_creator_read on public.campaign_workspaces for select to authenticated
using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = auth.uid() and c.archived_at is null));
grant select on public.campaign_workspaces to authenticated;
revoke insert, update, delete on public.campaign_workspaces from authenticated, anon;

create function public.save_campaign_workspace(p_campaign_id uuid, p_revision integer, p_state jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  if (auth.jwt()->>'is_anonymous')::boolean is distinct from false then
    raise exception 'A permanent account is required.';
  end if;
  perform 1 from public.campaigns where id = p_campaign_id and owner_id = auth.uid() and archived_at is null for update;
  if not found then raise exception 'Only the active campaign creator can edit this workspace.'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 5000000 then raise exception 'Invalid workspace state.'; end if;
  if p_revision = 0 then
    insert into public.campaign_workspaces(campaign_id, state) values (p_campaign_id, p_state)
    on conflict do nothing returning revision into next_revision;
  else
    update public.campaign_workspaces set state = p_state, revision = revision + 1, updated_at = now()
    where campaign_id = p_campaign_id and revision = p_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'Workspace changed in another window. Reload before editing.'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_campaign_workspace(uuid, integer, jsonb) from public;
grant execute on function public.save_campaign_workspace(uuid, integer, jsonb) to authenticated;
