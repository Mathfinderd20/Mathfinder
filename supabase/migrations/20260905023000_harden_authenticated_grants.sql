grant select on public.profiles to authenticated;

-- Membership identities are relationship keys. GMs may change roles, but not
-- rewrite a membership to point at another campaign or user.
revoke update on public.campaign_members from authenticated;
grant update (role) on public.campaign_members to authenticated;
