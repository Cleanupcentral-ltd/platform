begin;

insert into lead_engine.prospects (
  id,
  dedupe_key,
  business_name,
  sector
)
values (
  '44444444-4444-4444-8444-444444444444',
  'stage4-review-test',
  'Stage 4 Review Test',
  'offices_coworking'
);

select 1 / case
  when not has_function_privilege(
    'anon',
    'lead_engine.record_verified_lead_evidence(uuid,uuid,text,text,text,text,text,text,text,text)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'lead_engine.record_verified_lead_evidence(uuid,uuid,text,text,text,text,text,text,text,text)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'lead_engine.record_verified_lead_evidence(uuid,uuid,text,text,text,text,text,text,text,text)',
    'execute'
  )
  then 1
  else 0
end as record_function_privileges_passed;

select 1 / case
  when not has_function_privilege(
    'anon',
    'lead_engine.review_lead_evidence(uuid,uuid,uuid,text,text)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'lead_engine.review_lead_evidence(uuid,uuid,uuid,text,text)',
    'execute'
  ) and has_function_privilege(
    'service_role',
    'lead_engine.review_lead_evidence(uuid,uuid,uuid,text,text)',
    'execute'
  )
  then 1
  else 0
end as review_function_privileges_passed;

do $invalid_companies_house$
begin
  begin
    perform *
    from lead_engine.record_verified_lead_evidence(
      '44444444-4444-4444-8444-444444444444',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'companies_house',
      'https://find-and-update.company-information.service.gov.uk/company/00000000',
      'public_email',
      'hello@example.com',
      null,
      repeat('b', 64),
      'email',
      'hello@example.com'
    );
    raise exception
      'invalid Companies House fact was accepted';
  exception
    when sqlstate '22023' then
      null;
  end;
end
$invalid_companies_house$;

insert into lead_engine.evidence (
  prospect_id,
  source_url,
  source_type,
  field_name,
  field_value,
  verification_status
)
values (
  '44444444-4444-4444-8444-444444444444',
  'https://www.google.com/maps',
  'google_places',
  'business_name',
  'Stage 4 Review Test',
  'unverified'
);

do $invalid_provider_verification$
begin
  begin
    perform lead_engine.review_lead_evidence(
      '44444444-4444-4444-8444-444444444444',
      (
        select id
        from lead_engine.evidence
        where prospect_id =
          '44444444-4444-4444-8444-444444444444'
          and source_type =
            'google_places'
        limit 1
      ),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'verified',
      null
    );
    raise exception
      'provider evidence was accepted as verified';
  exception
    when sqlstate '22023' then
      null;
  end;
end
$invalid_provider_verification$;

select *
from lead_engine.record_verified_lead_evidence(
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'first_party_website',
  'https://example.com/contact',
  'public_email',
  'hello@example.com',
  'Public business email',
  repeat('a', 64),
  'email',
  'hello@example.com'
);

select 1 / case
  when (
    select count(*)
    from lead_engine.evidence
    where prospect_id =
      '44444444-4444-4444-8444-444444444444'
      and verification_status =
        'verified'
  ) = 1 and (
    select count(*)
    from lead_engine.contacts
    where prospect_id =
      '44444444-4444-4444-8444-444444444444'
      and verification_status =
        'verified'
  ) = 1
  then 1
  else 0
end as verified_capture_passed;

select lead_engine.review_lead_evidence(
  '44444444-4444-4444-8444-444444444444',
  (
    select id
    from lead_engine.evidence
    where prospect_id =
      '44444444-4444-4444-8444-444444444444'
      and source_type =
        'first_party_website'
    limit 1
  ),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'rejected',
  'Controlled test rejection'
);

select 1 / case
  when (
    select count(*)
    from lead_engine.evidence
    where prospect_id =
      '44444444-4444-4444-8444-444444444444'
      and verification_status =
        'rejected'
      and reviewed_by =
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) = 1 and (
    select count(*)
    from lead_engine.contacts
    where prospect_id =
      '44444444-4444-4444-8444-444444444444'
      and verification_status =
        'rejected'
  ) = 1
  then 1
  else 0
end as linked_rejection_passed;

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
)
values (
  '44444444-4444-4444-8444-444444444444',
  4,
  'cuc-lel-0-10-v1',
  '{"sectorServiceFit":{"points":1}}'::jsonb,
  'Research required.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'research_required',
  '["missing_verified_identity"]'::jsonb,
  '{}'::uuid[]
);

select 1 / case
  when (
    select count(*)
    from lead_engine.assessments
    where prospect_id =
      '44444444-4444-4444-8444-444444444444'
      and total_score = 4
      and eligibility_result =
        'research_required'
  ) = 1
  then 1
  else 0
end as assessment_snapshot_passed;

rollback;
