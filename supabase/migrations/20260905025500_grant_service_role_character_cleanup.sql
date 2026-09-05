-- Characters also reference profiles through runtime state ownership, so
-- trusted account cleanup removes them before deleting the Auth user.
grant select, delete on public.characters to service_role;
