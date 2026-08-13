begin;

insert into lead_engine.prospects (
  id,
  dedupe_key,
  business_name,
  sector,
  website_url,
  primary_postcode,
  created_at
) values (
  '78000000-0000-4000-8000-000000000001',
  'lead-export-test',
  'Lead Export Test Offices',
  'offices_coworking',
  'https://example.com/',
  'BR1 1AA',
  '2026-08-13T10:00:00Z'
);

insert into lead_engine.evidence (
  id,
  prospect_id,
  source_url,
  source_type,
  field_name,
  field_value,
  content_sha256,
  verification_status,
  verification_method,
  verified_at,
  verified_by
) values
  (
    '78100000-0000-4000-8000-000000000001',
    '78000000-0000-4000-8000-000000000001',
    'https://example.com/about',
    'first_party_website',
    'business_name',
    'Lead Export Test Offices',
    repeat('a', 64),
    'verified',
    'founder_review',
    now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '78100000-0000-4000-8000-000000000002',
    '78000000-0000-4000-8000-000000000001',
    'https://example.com/contact',
    'first_party_website',
    'public_email',
    'hello@example.com',
    repeat('b', 64),
    'verified',
    'founder_review',
    now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );

insert into lead_engine.contacts (
  id,
  prospect_id,
  contact_type,
  contact_value,
  normalized_value,
  source_evidence_id,
  verification_status,
  is_primary
) values (
  '78200000-0000-4000-8000-000000000001',
  '78000000-0000-4000-8000-000000000001',
  'email',
  'hello@example.com',
  'hello@example.com',
  '78100000-0000-4000-8000-000000000002',
  'verified',
  true
);

insert into lead_engine.assessments (
  prospect_id,
  total_score,
  rules_version,
  score_breakdown,
  rationale,
  assessed_by,
  eligibility_result,
  blockers,
  evidence_ids
) values (
  '78000000-0000-4000-8000-000000000001',
  8,
  'cuc-lel-0-10-v1.1',
  '{}'::jsonb,
  'Ready for export test.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'eligible',
  '[]'::jsonb,
  array[
    '78100000-0000-4000-8000-000000000001'::uuid,
    '78100000-0000-4000-8000-000000000002'::uuid
  ]
);

insert into lead_engine.activities (
  prospect_id,
  activity_type,
  outcome,
  follow_up_at,
  created_by
) values (
  '78000000-0000-4000-8000-000000000001',
  'outcome',
  'not_now',
  now() + interval '7 days',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

insert into lead_engine.suppressions (
  prospect_id,
  suppression_type,
  normalized_value,
  reason,
  source,
  created_by
) values (
  '78000000-0000-4000-8000-000000000001',
  'business',
  '78000000-0000-4000-8000-000000000001',
  'Export acceptance test',
  'founder_outreach_outcome',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select 1 / case
  when not has_table_privilege(
    'anon',
    'lead_engine.lead_exports',
    'select'
  ) and not has_table_privilege(
    'authenticated',
    'lead_engine.lead_exports',
    'select'
  ) and not has_function_privilege(
    'anon',
    'lead_engine.create_lead_export(uuid)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'lead_engine.create_lead_export(uuid)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'lead_engine.create_lead_export(uuid)',
    'execute'
  )
  then 1
  else 0
end as browser_export_denied_passed;

create temporary table export_result
on commit drop
as
select *
from lead_engine.create_lead_export(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

select 1 / case
  when (
    select count(*)
    from lead_engine.lead_exports
    where founder_id =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) = 1 and (
    select row_count
    from lead_engine.lead_exports
    where founder_id =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    order by created_at desc
    limit 1
  ) = (
    select count(*)
    from lead_engine.prospects
  )
  then 1
  else 0
end as export_audit_passed;

select 1 / case
  when exists (
    select 1
    from export_result
    where prospect_reference =
        '78000000-0000-4000-8000-000000000001'
      and business_name =
        'Lead Export Test Offices'
      and verified_contact_route =
        'hello@example.com'
      and eligibility_result =
        'eligible'
      and total_score = 8
      and rules_version =
        'cuc-lel-0-10-v1.1'
      and status = 'suppressed'
      and outcome = 'not_now'
      and next_follow_up_at is not null
      and suppression_state
      and source_urls @> array[
        'https://example.com/about',
        'https://example.com/contact'
      ]::text[]
  )
  then 1
  else 0
end as export_content_passed;

rollback;
