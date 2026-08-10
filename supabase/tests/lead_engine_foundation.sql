begin;

select 1 / case
  when not has_schema_privilege(
    'anon',
    'lead_engine',
    'usage'
  ) and not has_schema_privilege(
    'authenticated',
    'lead_engine',
    'usage'
  ) and has_schema_privilege(
    'service_role',
    'lead_engine',
    'usage'
  )
  then 1
  else 0
end as least_privilege_passed;

insert into lead_engine.prospects (
  id,
  dedupe_key,
  business_name,
  sector
) values (
  '11111111-1111-4111-8111-111111111111',
  'stage2-rls-test',
  'Stage 2 RLS Test',
  'offices_coworking'
);

grant usage on schema lead_engine
to authenticated;

grant select on lead_engine.prospects
to authenticated;

set local request.jwt.claims =
  '{"aal":"aal1","app_metadata":{"role":"founder"}}';

set local role authenticated;

select 1 / case
  when count(*) = 0 then 1
  else 0
end as aal1_denied_passed
from lead_engine.prospects
where id =
  '11111111-1111-4111-8111-111111111111';

reset role;

set local request.jwt.claims =
  '{"aal":"aal2","app_metadata":{"role":"founder"}}';

set local role authenticated;

select 1 / case
  when count(*) = 1 then 1
  else 0
end as founder_aal2_allowed_passed
from lead_engine.prospects
where id =
  '11111111-1111-4111-8111-111111111111';

reset role;

rollback;
