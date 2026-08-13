begin;

insert into lead_engine.prospects (
  id,
  dedupe_key,
  business_name,
  sector
) values (
  '77777777-7777-4777-8777-777777777777',
  'outlook-draft-test',
  'Outlook Draft Test Offices',
  'offices_coworking'
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
    '71000000-0000-4000-8000-000000000001',
    '77777777-7777-4777-8777-777777777777',
    'https://example.com/about',
    'first_party_website',
    'business_name',
    'Outlook Draft Test Offices',
    repeat('a', 64),
    'verified',
    'founder_review',
    now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '77777777-7777-4777-8777-777777777777',
    'https://example.com/about',
    'first_party_website',
    'approved_sector',
    'offices_coworking',
    repeat('b', 64),
    'verified',
    'founder_review',
    now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '77777777-7777-4777-8777-777777777777',
    'https://example.com/about',
    'first_party_website',
    'business_status',
    'active',
    repeat('c', 64),
    'verified',
    'founder_review',
    now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '71000000-0000-4000-8000-000000000004',
    '77777777-7777-4777-8777-777777777777',
    'https://example.com/legal',
    'first_party_website',
    'subscriber_type',
    'corporate',
    repeat('d', 64),
    'verified',
    'founder_review',
    now(),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '71000000-0000-4000-8000-000000000005',
    '77777777-7777-4777-8777-777777777777',
    'https://example.com/contact',
    'first_party_website',
    'public_email',
    'hello@example.com',
    repeat('e', 64),
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
  '72000000-0000-4000-8000-000000000001',
  '77777777-7777-4777-8777-777777777777',
  'email',
  'hello@example.com',
  'hello@example.com',
  '71000000-0000-4000-8000-000000000005',
  'verified',
  true
);

insert into lead_engine.assessments (
  id,
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
  '73000000-0000-4000-8000-000000000001',
  '77777777-7777-4777-8777-777777777777',
  8,
  'cuc-lel-0-10-v1.1',
  '{}'::jsonb,
  'Ready for founder draft approval.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'eligible',
  '[]'::jsonb,
  array[
    '71000000-0000-4000-8000-000000000001'::uuid,
    '71000000-0000-4000-8000-000000000002'::uuid,
    '71000000-0000-4000-8000-000000000003'::uuid,
    '71000000-0000-4000-8000-000000000004'::uuid,
    '71000000-0000-4000-8000-000000000005'::uuid
  ]
);

update lead_engine.company_enrichment
set
  qualification_version =
    'stage_4_2_v1',
  qualification_state =
    'ready_for_outreach',
  status = 'verified_existing'
where prospect_id =
  '77777777-7777-4777-8777-777777777777';

select 1 / case
  when not has_table_privilege(
    'anon',
    'lead_engine.outlook_connections',
    'select'
  ) and not has_table_privilege(
    'authenticated',
    'lead_engine.outlook_connections',
    'select'
  ) and not has_table_privilege(
    'anon',
    'lead_engine.outlook_oauth_states',
    'select'
  ) and not has_table_privilege(
    'authenticated',
    'lead_engine.outlook_oauth_states',
    'select'
  )
  then 1
  else 0
end as outlook_secrets_private_passed;

select 1 / case
  when not has_function_privilege(
    'anon',
    'lead_engine.prepare_outlook_draft(uuid,uuid,uuid,text,text,text,text,text,uuid[])',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'lead_engine.prepare_outlook_draft(uuid,uuid,uuid,text,text,text,text,text,uuid[])',
    'execute'
  )
  then 1
  else 0
end as browser_draft_rpc_denied_passed;

select *
from lead_engine.prepare_outlook_draft(
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '72000000-0000-4000-8000-000000000001',
  'hello@example.com',
  'Cleaning support for Outlook Draft Test Offices',
  'Hello',
  'initial_outreach_v1',
  repeat('f', 64),
  array[
    '71000000-0000-4000-8000-000000000001'::uuid,
    '71000000-0000-4000-8000-000000000002'::uuid,
    '71000000-0000-4000-8000-000000000003'::uuid,
    '71000000-0000-4000-8000-000000000004'::uuid,
    '71000000-0000-4000-8000-000000000005'::uuid
  ]
);

select *
from lead_engine.mark_outlook_draft_created(
  (
    select id
    from lead_engine.outreach_drafts
    where prospect_id =
      '77777777-7777-4777-8777-777777777777'
  ),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'graph-draft-test-id',
  'https://outlook.live.com/mail/0/drafts/id/graph-draft-test-id'
);

select 1 / case
  when (
    select count(*)
    from lead_engine.activities
    where prospect_id =
        '77777777-7777-4777-8777-777777777777'
      and activity_type =
        'outlook_draft_created'
  ) = 1 and (
    select count(*)
    from lead_engine.activities
    where prospect_id =
        '77777777-7777-4777-8777-777777777777'
      and activity_type = 'contacted'
  ) = 0
  then 1
  else 0
end as drafted_is_not_contacted_passed;

select *
from lead_engine.prepare_outlook_draft(
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '72000000-0000-4000-8000-000000000001',
  'hello@example.com',
  'Changed after approval',
  'Changed after approval',
  'initial_outreach_v1',
  repeat('0', 64),
  array[
    '71000000-0000-4000-8000-000000000005'::uuid
  ]
);

select 1 / case
  when (
    select count(*)
    from lead_engine.outreach_drafts
    where prospect_id =
      '77777777-7777-4777-8777-777777777777'
      and contact_id is not null
  ) = 1 and (
    select subject
    from lead_engine.outreach_drafts
    where prospect_id =
      '77777777-7777-4777-8777-777777777777'
      and contact_id is not null
  ) = 'Cleaning support for Outlook Draft Test Offices' and (
    select preview_sha256
    from lead_engine.outreach_drafts
    where prospect_id =
      '77777777-7777-4777-8777-777777777777'
      and contact_id is not null
  ) = repeat('f', 64)
  then 1
  else 0
end as approved_draft_is_immutable_and_unique_passed;

select *
from lead_engine.record_outreach_activity(
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'contacted',
  null,
  'Founder sent the reviewed draft manually.',
  null
);

select *
from lead_engine.record_outreach_activity(
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'outcome',
  'do_not_contact',
  'Recipient asked not to be contacted.',
  null
);

select 1 / case
  when exists (
    select 1
    from lead_engine.suppressions
    where prospect_id =
        '77777777-7777-4777-8777-777777777777'
      and lifted_at is null
  )
  then 1
  else 0
end as do_not_contact_suppression_passed;

rollback;
