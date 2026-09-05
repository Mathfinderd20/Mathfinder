-- Campaign ownership uses ON DELETE RESTRICT, so trusted account-cleanup jobs
-- need narrowly scoped access to identify and remove a user's campaigns first.
grant select, delete on public.campaigns to service_role;
