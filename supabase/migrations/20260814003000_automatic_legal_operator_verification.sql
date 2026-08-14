alter table lead_engine.evidence
drop constraint if exists
  evidence_verification_method_check;

alter table lead_engine.evidence
add constraint
  evidence_verification_method_check
check (
  verification_method in (
    'founder_review',
    'automatic_first_party_company_number',
    'automatic_first_party_legal_operator',
    'automatic_first_party_research'
  )
);

create or replace function
lead_engine.record_automatic_legal_operator_verification(
  p_prospect_id uuid,
  p_actor_id uuid,
  p_attempt_count integer,
  p_operator_name text,
  p_website_source_url text,
  p_website_source_excerpt text,
  p_website_content_sha256 text,
  p_companies_house_source_url text,
  p_facts jsonb
)
returns table (
  evidence_ids uuid[]
)
language plpgsql
security invoker
set search_path = ''
as $record_automatic_legal_operator_verification$
declare
  v_company_number text;
  v_company_name text;
  v_official_evidence_ids uuid[];
  v_operator_evidence_id uuid;
  v_job_actor_id uuid;
  v_job_status text;
  v_job_attempt_count integer;
  v_operator_normalized text;
  v_company_normalized text;
  v_excerpt_normalized text;
begin
  select
    actor_id,
    status,
    attempt_count
  into
    v_job_actor_id,
    v_job_status,
    v_job_attempt_count
  from lead_engine.company_enrichment
  where prospect_id = p_prospect_id
    and qualification_version =
      'stage_4_2_v1'
  for update;

  if not found or
    v_job_actor_id is distinct from
      p_actor_id or
    v_job_status <> 'processing' or
    v_job_attempt_count <>
      p_attempt_count
  then
    raise exception
      'stale automatic qualification claim'
      using errcode = '40001';
  end if;

  if
    p_website_source_url !~* '^https://' or
    p_website_content_sha256
      !~ '^[0-9a-f]{64}$' or
    nullif(
      btrim(
        p_website_source_excerpt
      ),
      ''
    ) is null or
    nullif(
      btrim(p_operator_name),
      ''
    ) is null or
    length(p_operator_name) > 120
  then
    raise exception
      'invalid first-party legal-operator evidence'
      using errcode = '22023';
  end if;

  select item ->> 'field_value'
  into v_company_number
  from jsonb_array_elements(p_facts)
    as item
  where item ->> 'field_name' =
    'company_number';

  select item ->> 'field_value'
  into v_company_name
  from jsonb_array_elements(p_facts)
    as item
  where item ->> 'field_name' =
    'business_name';

  v_operator_normalized :=
    regexp_replace(
      upper(p_operator_name),
      '[^A-Z0-9]+',
      '',
      'g'
    );

  v_company_normalized :=
    regexp_replace(
      upper(v_company_name),
      '[^A-Z0-9]+',
      '',
      'g'
    );

  v_excerpt_normalized :=
    regexp_replace(
      upper(
        p_website_source_excerpt
      ),
      '[^A-Z0-9]+',
      '',
      'g'
    );

  if
    v_operator_normalized = '' or
    v_company_normalized is distinct
      from v_operator_normalized or
    position(
      v_operator_normalized in
        v_excerpt_normalized
    ) = 0
  then
    raise exception
      'Companies House legal name does not exactly match first-party operator'
      using errcode = '22023';
  end if;

  select verification.evidence_ids
  into v_official_evidence_ids
  from
    lead_engine.record_companies_house_verification(
      p_prospect_id,
      p_actor_id,
      p_companies_house_source_url,
      p_facts
    ) as verification;

  select evidence.evidence_id
  into v_operator_evidence_id
  from lead_engine.record_verified_lead_evidence(
    p_prospect_id,
    p_actor_id,
    'first_party_website',
    p_website_source_url,
    'legal_operator_name',
    p_operator_name,
    p_website_source_excerpt,
    p_website_content_sha256,
    null,
    null
  ) as evidence;

  update lead_engine.evidence
  set verification_method =
    'automatic_first_party_legal_operator'
  where id = any(
    array_append(
      v_official_evidence_ids,
      v_operator_evidence_id
    )
  );

  update lead_engine.company_enrichment
  set
    status = 'auto_verified',
    discovered_company_number =
      v_company_number,
    source_url =
      p_website_source_url,
    source_excerpt =
      p_website_source_excerpt,
    source_content_sha256 =
      p_website_content_sha256,
    candidates = '[]'::jsonb,
    last_error_code = null,
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where prospect_id = p_prospect_id;

  return query
  select array_append(
    v_official_evidence_ids,
    v_operator_evidence_id
  );
end
$record_automatic_legal_operator_verification$;

revoke all on function
lead_engine.record_automatic_legal_operator_verification(
  uuid,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute on function
lead_engine.record_automatic_legal_operator_verification(
  uuid,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to service_role;
