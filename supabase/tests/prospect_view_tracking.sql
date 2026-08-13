begin;

insert into lead_engine.prospects (
  id,
  dedupe_key,
  business_name,
  sector
) values (
  '55555555-5555-4555-8555-555555555555',
  'prospect-view-test',
  'Prospect View Test',
  'offices_coworking'
);

select 1 / case
  when not has_table_privilege(
    'anon',
    'lead_engine.prospect_views',
    'select'
  ) and not has_table_privilege(
    'authenticated',
    'lead_engine.prospect_views',
    'select'
  ) and has_table_privilege(
    'service_role',
    'lead_engine.prospect_views',
    'select,insert,update,delete'
  )
  then 1
  else 0
end as prospect_view_privileges_passed;

select 1 / case
  when not has_function_privilege(
    'anon',
    'lead_engine.set_prospect_view_state(uuid,uuid,boolean)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'lead_engine.set_prospect_view_state(uuid,uuid,boolean)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'lead_engine.set_prospect_view_state(uuid,uuid,boolean)',
    'execute'
  )
  then 1
  else 0
end as prospect_view_function_privileges_passed;

select *
from lead_engine.set_prospect_view_state(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  true
);

select *
from lead_engine.set_prospect_view_state(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  true
);

select 1 / case
  when (
    select count(*)
    from lead_engine.prospect_views
    where founder_id =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and prospect_id =
        '55555555-5555-4555-8555-555555555555'
  ) = 1
  then 1
  else 0
end as prospect_view_upsert_passed;

select *
from lead_engine.set_prospect_view_state(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  false
);

select 1 / case
  when (
    select count(*)
    from lead_engine.prospect_views
    where founder_id =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and prospect_id =
        '55555555-5555-4555-8555-555555555555'
  ) = 0
  then 1
  else 0
end as prospect_mark_unseen_passed;

rollback;
