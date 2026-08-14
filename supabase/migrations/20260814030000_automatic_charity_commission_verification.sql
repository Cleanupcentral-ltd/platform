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
    'automatic_first_party_charity_number',
    'automatic_first_party_research'
  )
);

create or replace function
lead_engine.record_automatic_charity_commission_verification(
  p_prospect_id uuid,
  p_actor_id uuid,
  p_attempt_count integer,
  p_charity_number text,
  p_website_source_url text,
  p_website_source_excerpt text,
  p_website_content_sha256 text,
  p_charity_commission_source_url text,
  p_facts jsonb
)
returns table (
  evidence_ids uuid[]
)
language plpgsql
security invoker
set search_path = ''
as $record_automatic_charity_commission_verification$
declare
  v_fact jsonb;
  v_field_name text;
  v_field_value text;
  v_source_excerpt text;
  v_content_sha256 text;
  v_evidence_id uuid;
  v_evidence_ids uuid[] := '{}'::uuid[];
  v_first_party_evidence_id uuid;
  v_job_actor_id uuid;
  v_job_status text;
  v_job_attempt_count integer;
  v_excerpt_digits text;
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

  p_charity_number :=
    regexp_replace(
      p_charity_number,
      '[^0-9]+',
      '',
      'g'
    );

  v_excerpt_digits :=
    regexp_replace(
      coalesce(
        p_website_source_excerpt,
        ''
      ),
      '[^0-9]+',
      '',
      'g'
    );

  if
    p_charity_number !~ '^[0-9]{6,7}$' or
    p_website_source_url !~* '^https://' or
    p_website_content_sha256
      !~ '^[0-9a-f]{64}$' or
    nullif(
      btrim(
        p_website_source_excerpt
      ),
      ''
    ) is null or
    position(
      p_charity_number in
        v_excerpt_digits
    ) = 0 or
    p_charity_commission_source_url
      !~* '^https://([a-z0-9-]+\.)*charitycommission\.gov\.uk/'
  then
    raise exception
      'invalid first-party or Charity Commission evidence'
      using errcode = '22023';
  end if;

  if
    jsonb_typeof(p_facts) <>
      'array' or
    jsonb_array_length(p_facts) <>
      3
  then
    raise exception
      'Charity Commission verification requires exactly three official facts'
      using errcode = '22023';
  end if;

  insert into lead_engine.evidence (
    prospect_id,
    source_url,
    source_type,
    field_name,
    field_value,
    source_excerpt,
    content_sha256,
    verification_status,
    verified_at,
    verified_by,
    reviewed_at,
    reviewed_by,
    verification_method
  ) values (
    p_prospect_id,
    p_website_source_url,
    'first_party_website',
    'charity_number',
    p_charity_number,
    p_website_source_excerpt,
    p_website_content_sha256,
    'verified',
    now(),
    p_actor_id,
    now(),
    p_actor_id,
    'automatic_first_party_charity_number'
  )
  on conflict (
    prospect_id,
    content_sha256
  )
  where content_sha256 is not null
  do update set
    source_url = excluded.source_url,
    source_type = excluded.source_type,
    field_name = excluded.field_name,
    field_value = excluded.field_value,
    source_excerpt =
      excluded.source_excerpt,
    verification_status = 'verified',
    verified_at = now(),
    verified_by = p_actor_id,
    reviewed_at = now(),
    reviewed_by = p_actor_id,
    review_note = null,
    verification_method =
      'automatic_first_party_charity_number'
  returning id into
    v_first_party_evidence_id;

  v_evidence_ids := array_append(
    v_evidence_ids,
    v_first_party_evidence_id
  );

  for v_fact in
    select value
    from jsonb_array_elements(
      p_facts
    )
  loop
    v_field_name :=
      v_fact ->> 'field_name';
    v_field_value :=
      nullif(
        btrim(
          v_fact ->> 'field_value'
        ),
        ''
      );
    v_source_excerpt :=
      nullif(
        btrim(
          v_fact ->> 'source_excerpt'
        ),
        ''
      );
    v_content_sha256 :=
      v_fact ->> 'content_sha256';

    if
      v_field_name not in (
        'registered_charity_name',
        'business_status',
        'charity_number'
      ) or
      v_field_value is null or
      v_source_excerpt is null or
      length(v_source_excerpt) > 700 or
      v_content_sha256
        !~ '^[0-9a-f]{64}$'
    then
      raise exception
        'invalid Charity Commission fact'
        using errcode = '22023';
    end if;

    if
      v_field_name =
        'charity_number' and
      regexp_replace(
        v_field_value,
        '[^0-9]+',
        '',
        'g'
      ) <> p_charity_number
    then
      raise exception
        'Charity Commission number does not match first-party assertion'
        using errcode = '22023';
    end if;

    if
      v_field_name =
        'business_status' and
      v_field_value not in (
        'active',
        'inactive'
      )
    then
      raise exception
        'invalid Charity Commission status'
        using errcode = '22023';
    end if;

    insert into lead_engine.evidence (
      prospect_id,
      source_url,
      source_type,
      field_name,
      field_value,
      source_excerpt,
      content_sha256,
      verification_status,
      verified_at,
      verified_by,
      reviewed_at,
      reviewed_by,
      verification_method
    ) values (
      p_prospect_id,
      p_charity_commission_source_url,
      'charity_commission',
      v_field_name,
      v_field_value,
      v_source_excerpt,
      v_content_sha256,
      'verified',
      now(),
      p_actor_id,
      now(),
      p_actor_id,
      'automatic_first_party_charity_number'
    )
    on conflict (
      prospect_id,
      content_sha256
    )
    where content_sha256 is not null
    do update set
      source_url = excluded.source_url,
      source_type = excluded.source_type,
      field_name = excluded.field_name,
      field_value = excluded.field_value,
      source_excerpt =
        excluded.source_excerpt,
      verification_status = 'verified',
      verified_at = now(),
      verified_by = p_actor_id,
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      review_note = null,
      verification_method =
        'automatic_first_party_charity_number'
    returning id into
      v_evidence_id;

    v_evidence_ids := array_append(
      v_evidence_ids,
      v_evidence_id
    );
  end loop;

  if (
    select count(*)
    from jsonb_array_elements(
      p_facts
    ) as item
    where item ->> 'field_name' =
      'charity_number'
  ) <> 1 or
  (
    select count(*)
    from jsonb_array_elements(
      p_facts
    ) as item
    where item ->> 'field_name' =
      'registered_charity_name'
  ) <> 1 or
  (
    select count(*)
    from jsonb_array_elements(
      p_facts
    ) as item
    where item ->> 'field_name' =
      'business_status'
  ) <> 1
  then
    raise exception
      'Charity Commission fact set is incomplete'
      using errcode = '22023';
  end if;

  return query
  select v_evidence_ids;
end
$record_automatic_charity_commission_verification$;

revoke all on function
lead_engine.record_automatic_charity_commission_verification(
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
lead_engine.record_automatic_charity_commission_verification(
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
