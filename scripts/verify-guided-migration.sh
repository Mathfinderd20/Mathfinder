#!/usr/bin/env bash
# Isolated CI database only; never links to or writes a hosted project.
set -euo pipefail

migration="supabase/migrations/20260911010000_guided_creation_traits.sql"
held_migration="$(mktemp)"
restore_migration() {
  if [[ -f "$held_migration" ]]; then mv "$held_migration" "$migration"; fi
}
trap restore_migration EXIT
mv "$migration" "$held_migration"

# Replay all earlier migrations with real Supabase auth schemas and RLS.
supabase db start
db_container="supabase_db_mathfinder"
docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email,is_anonymous) values
('88888888-8888-4888-8888-888888888888','upgrade-owner@example.invalid',false);
insert into public.campaigns(id,owner_id,name,creation_rules) values
('99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888','Legacy campaign',
'{"startingLevel":3,"method":"point-buy","pointBuyBudget":20,"abilityArray":[15,14,13,12,10,8],"buildGuide":"Keep this guide"}'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','88888888-8888-4888-8888-888888888888','Unrestricted campaign',null);
SQL

restore_migration
supabase migration up --local

docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if (select creation_rules from public.campaigns where id='99999999-9999-4999-8999-999999999999')
    is distinct from '{"startingLevel":3,"method":"point-buy","pointBuyBudget":20,"abilityArray":[15,14,13,12,10,8],"buildGuide":"Keep this guide"}'::jsonb then
    raise exception 'Migration changed existing creation rules';
  end if;
  if (select creation_rules from public.campaigns where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is not null then
    raise exception 'Migration changed an unrestricted campaign';
  end if;
  if not exists(select 1 from public.campaign_members where campaign_id='99999999-9999-4999-8999-999999999999' and user_id='88888888-8888-4888-8888-888888888888' and role='gm') then
    raise exception 'Campaign ownership changed';
  end if;
end $$;
SQL

for test_file in supabase/tests/*.sql; do
  echo "Running $test_file"
  docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$test_file"
done

supabase db lint --local --fail-on error
