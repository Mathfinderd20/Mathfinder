-- Inactive campaigns no longer confer access to shared characters or profiles.
-- Deactivation itself remains available to a GM through a trusted function.

create or replace function public.is_campaign_member(
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
    from public.campaign_members member
    join public.campaigns campaign on campaign.id = member.campaign_id
    where member.campaign_id = target_campaign_id
      and member.user_id = target_user_id
      and campaign.archived_at is null
  );
$$;

create or replace function public.is_campaign_gm(
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
    from public.campaign_members member
    join public.campaigns campaign on campaign.id = member.campaign_id
    where member.campaign_id = target_campaign_id
      and member.user_id = target_user_id
      and member.role = 'gm'
      and campaign.archived_at is null
  );
$$;

create or replace function public.shares_campaign_with(
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
    join public.campaigns campaign
      on campaign.id = viewer.campaign_id
    where viewer.user_id = viewer_user_id
      and target.user_id = target_user_id
      and campaign.archived_at is null
  );
$$;

create function public.deactivate_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) then
    raise exception 'A permanent account is required.' using errcode = '42501';
  end if;
  if not public.is_campaign_gm(p_campaign_id) then
    raise exception 'Only an active campaign GM can deactivate this campaign.'
      using errcode = '42501';
  end if;

  update public.campaigns
  set archived_at = now()
  where id = p_campaign_id
    and archived_at is null;
  if not found then
    raise exception 'Campaign is already inactive or unavailable.';
  end if;
end;
$$;

revoke all on function public.deactivate_campaign(uuid) from public;
grant execute on function public.deactivate_campaign(uuid) to authenticated;

