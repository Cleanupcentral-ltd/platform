begin;

insert into lead_engine.prospects (
  id,
  dedupe_key,
  business_name,
  sector
) values
  (
    '66666666-6666-4666-8666-666666666661',
    'controlled-rollout-test-1',
    'Controlled Rollout Test One',
    'offices_coworking'
  ),
  (
    '66666666-6666-4666-8666-666666666662',
    'controlled-rollout-test-2',
    'Controlled Rollout Test Two',
    'offices_coworking'
  );

select 1 / case
  when not has_function_privilege(
    'anon',
    'lead_engine.activate_automatic_qualification_v1(integer)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'lead_engine.activate_automatic_qualification_v1(integer)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'lead_engine.activate_automatic_qualification_v1(integer)',
    'execute'
  )
  then 1
  else 0
end as controlled_activation_privileges_passed;

select 1 / case
  when lead_engine.activate_automatic_qualification_v1(1) = 1
  then 1
  else 0
end as one_business_canary_admitted;

select 1 / case
  when lead_engine.activate_automatic_qualification_v1(1) = 0
  then 1
  else 0
end as canary_total_limit_preserved;

select 1 / case
  when (
    select count(*)
    from lead_engine.company_enrichment
    where qualification_version =
      'stage_4_2_v1'
  ) = 1
  then 1
  else 0
end as exactly_one_business_versioned;

rollback;
