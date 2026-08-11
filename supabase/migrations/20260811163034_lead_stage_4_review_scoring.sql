alter table lead_engine.evidence
add column reviewed_at timestamptz,
add column reviewed_by uuid,
add column review_note text;

alter table lead_engine.assessments
add column eligibility_result text not null
  default 'research_required'
  check (
    eligibility_result in (
      'eligible',
      'research_required'
    )
  ),
add column blockers jsonb not null
  default '[]'::jsonb
  check (
    jsonb_typeof(blockers) = 'array'
  ),
add column evidence_ids uuid[] not null
  default '{}'::uuid[];

create index evidence_prospect_review_idx
on lead_engine.evidence (
  prospect_id,
  verification_status,
  field_name
);

create or replace function
lead_engine.record_verified_lead_evidence(
  p_prospect_id uuid,
  p_founder_id uuid,
  p_source_type text,
  p_source_url text,
  p_field_name text,
  p_field_value text,
  p_source_excerpt text,
  p_content_sha256 text,
  p_contact_type text,
  p_normalized_contact_value text
)
returns table (
  evidence_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $record_verified_lead_evidence$
declare
  v_evidence_id uuid;
begin
  if p_source_type not in (
    'first_party_website',
    'companies_house'
  ) then
    raise exception
      'unsupported verification source'
      using errcode = '22023';
  end if;

  if p_field_name not in (
    'business_name',
    'approved_sector',
    'business_status',
    'trading_address',
    'website_url',
    'public_email',
    'contact_form_url',
    'recurring_cleaning_need',
    'premises_scale',
    'subscriber_type',
    'company_number'
  ) then
    raise exception
      'unsupported verification fact'
      using errcode = '22023';
  end if;

  if p_source_url !~* '^https://' then
    raise exception
      'verification source must use HTTPS'
      using errcode = '22023';
  end if;

  if
    p_source_type = 'companies_house' and
    (
      p_source_url !~* '^https://(find-and-update|api)\.company-information\.service\.gov\.uk/' or
      p_field_name not in (
        'business_name',
        'approved_sector',
        'business_status',
        'subscriber_type',
        'company_number'
      )
    )
  then
    raise exception
      'invalid Companies House evidence'
      using errcode = '22023';
  end if;

  if p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception
      'invalid evidence fingerprint'
      using errcode = '22023';
  end if;

  perform 1
  from lead_engine.prospects
  where id = p_prospect_id;

  if not found then
    raise exception
      'prospect not found'
      using errcode = 'P0002';
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
    reviewed_by
  )
  values (
    p_prospect_id,
    p_source_url,
    p_source_type,
    p_field_name,
    p_field_value,
    nullif(p_source_excerpt, ''),
    p_content_sha256,
    'verified',
    now(),
    p_founder_id,
    now(),
    p_founder_id
  )
  on conflict (
    prospect_id,
    content_sha256
  )
  where content_sha256 is not null
  do update
  set
    source_url = excluded.source_url,
    source_type = excluded.source_type,
    field_name = excluded.field_name,
    field_value = excluded.field_value,
    source_excerpt = excluded.source_excerpt,
    verification_status = 'verified',
    verified_at = now(),
    verified_by = p_founder_id,
    reviewed_at = now(),
    reviewed_by = p_founder_id,
    review_note = null
  returning id into v_evidence_id;

  if p_contact_type is not null then
    if
      p_contact_type not in (
        'email',
        'contact_form'
      ) or
      nullif(
        p_normalized_contact_value,
        ''
      ) is null
    then
      raise exception
        'invalid verified contact route'
        using errcode = '22023';
    end if;

    insert into lead_engine.contacts (
      prospect_id,
      contact_type,
      contact_value,
      normalized_value,
      source_evidence_id,
      verification_status
    )
    values (
      p_prospect_id,
      p_contact_type,
      p_field_value,
      p_normalized_contact_value,
      v_evidence_id,
      'verified'
    )
    on conflict (
      prospect_id,
      contact_type,
      normalized_value
    )
    do update
    set
      contact_value = excluded.contact_value,
      source_evidence_id = excluded.source_evidence_id,
      verification_status = 'verified';
  end if;

  if p_field_name = 'company_number' then
    update lead_engine.prospects
    set
      company_number = p_field_value,
      updated_at = now()
    where id = p_prospect_id;
  elsif p_field_name = 'website_url' then
    update lead_engine.prospects
    set
      website_url = p_field_value,
      updated_at = now()
    where id = p_prospect_id;
  end if;

  return query
  select v_evidence_id;
end
$record_verified_lead_evidence$;

create or replace function
lead_engine.review_lead_evidence(
  p_prospect_id uuid,
  p_evidence_id uuid,
  p_founder_id uuid,
  p_decision text,
  p_review_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $review_lead_evidence$
declare
  updated_rows integer;
begin
  if p_decision not in (
    'verified',
    'rejected'
  ) then
    raise exception
      'invalid evidence decision'
      using errcode = '22023';
  end if;

  if
    p_decision = 'verified' and
    not exists (
      select 1
      from lead_engine.evidence
      where id = p_evidence_id
        and prospect_id =
          p_prospect_id
        and source_type in (
          'first_party_website',
          'companies_house'
        )
    )
  then
    raise exception
      'only first-party or Companies House evidence can be verified'
      using errcode = '22023';
  end if;

  update lead_engine.evidence
  set
    verification_status = p_decision,
    reviewed_at = now(),
    reviewed_by = p_founder_id,
    review_note =
      nullif(p_review_note, ''),
    verified_at = case
      when p_decision = 'verified'
        then now()
      else null
    end,
    verified_by = case
      when p_decision = 'verified'
        then p_founder_id
      else null
    end
  where id = p_evidence_id
    and prospect_id = p_prospect_id;

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception
      'evidence not found'
      using errcode = 'P0002';
  end if;

  update lead_engine.contacts
  set verification_status = p_decision
  where prospect_id = p_prospect_id
    and source_evidence_id =
      p_evidence_id;
end
$review_lead_evidence$;

revoke all on function
lead_engine.record_verified_lead_evidence(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute on function
lead_engine.record_verified_lead_evidence(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
to service_role;

revoke all on function
lead_engine.review_lead_evidence(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute on function
lead_engine.review_lead_evidence(
  uuid,
  uuid,
  uuid,
  text,
  text
)
to service_role;

comment on function
lead_engine.record_verified_lead_evidence(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
is
  'Records one founder-reviewed first-party or Companies House fact and any linked public contact route atomically.';

comment on function
lead_engine.review_lead_evidence(
  uuid,
  uuid,
  uuid,
  text,
  text
)
is
  'Applies one founder verified or rejected decision to evidence and its linked contact route atomically.';
