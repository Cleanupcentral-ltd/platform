create or replace function
lead_engine.record_companies_house_verification(
  p_prospect_id uuid,
  p_founder_id uuid,
  p_source_url text,
  p_facts jsonb
)
returns table (
  evidence_ids uuid[]
)
language plpgsql
security invoker
set search_path = ''
as $record_companies_house_verification$
declare
  fact_item jsonb;
  v_company_number text;
  v_evidence_id uuid;
  v_evidence_ids uuid[] := '{}'::uuid[];
begin
  if
    p_source_url !~* '^https://find-and-update\.company-information\.service\.gov\.uk/company/[A-Z0-9]+$'
  then
    raise exception
      'invalid Companies House profile URL'
      using errcode = '22023';
  end if;

  if
    jsonb_typeof(p_facts) <> 'array' or
    jsonb_array_length(p_facts) <> 4
  then
    raise exception
      'Companies House verification requires exactly four facts'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_facts) as item
    where item ->> 'field_name' not in (
      'business_name',
      'company_number',
      'business_status',
      'subscriber_type'
    )
  ) then
    raise exception
      'unsupported Companies House verification fact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select
        item ->> 'field_name' as field_name,
        count(*) as fact_count
      from jsonb_array_elements(p_facts) as item
      group by item ->> 'field_name'
    ) as counts
    where counts.fact_count <> 1
  ) or (
    select count(distinct item ->> 'field_name')
    from jsonb_array_elements(p_facts) as item
  ) <> 4 then
    raise exception
      'Companies House verification facts must be unique'
      using errcode = '22023';
  end if;

  select item ->> 'field_value'
  into v_company_number
  from jsonb_array_elements(p_facts) as item
  where item ->> 'field_name' =
    'company_number';

  if
    v_company_number !~ '^[A-Z0-9]{6,12}$' or
    p_source_url not like
      '%/' || v_company_number
  then
    raise exception
      'Companies House number does not match source'
      using errcode = '22023';
  end if;

  if (
    select item ->> 'field_value'
    from jsonb_array_elements(p_facts) as item
    where item ->> 'field_name' =
      'business_status'
  ) not in ('active', 'inactive') then
    raise exception
      'invalid Companies House business status'
      using errcode = '22023';
  end if;

  if (
    select item ->> 'field_value'
    from jsonb_array_elements(p_facts) as item
    where item ->> 'field_name' =
      'subscriber_type'
  ) not in (
    'corporate',
    'partnership',
    'unknown'
  ) then
    raise exception
      'invalid Companies House subscriber type'
      using errcode = '22023';
  end if;

  perform 1
  from lead_engine.prospects
  where id = p_prospect_id
  for update;

  if not found then
    raise exception
      'prospect not found'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from lead_engine.prospects
    where company_number = v_company_number
      and id <> p_prospect_id
  ) then
    raise exception
      'company number is linked to another prospect'
      using errcode = '23505';
  end if;

  for fact_item in
    select value
    from jsonb_array_elements(p_facts)
  loop
    if
      nullif(
        btrim(fact_item ->> 'field_value'),
        ''
      ) is null or
      (fact_item ->> 'content_sha256')
        !~ '^[0-9a-f]{64}$'
    then
      raise exception
        'invalid Companies House fact value or fingerprint'
        using errcode = '22023';
    end if;

    select evidence_id
    into v_evidence_id
    from lead_engine.record_verified_lead_evidence(
      p_prospect_id,
      p_founder_id,
      'companies_house',
      p_source_url,
      fact_item ->> 'field_name',
      fact_item ->> 'field_value',
      nullif(
        fact_item ->> 'source_excerpt',
        ''
      ),
      fact_item ->> 'content_sha256',
      null,
      null
    );

    v_evidence_ids := array_append(
      v_evidence_ids,
      v_evidence_id
    );
  end loop;

  return query
  select v_evidence_ids;
end
$record_companies_house_verification$;

revoke all on function
lead_engine.record_companies_house_verification(
  uuid,
  uuid,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute on function
lead_engine.record_companies_house_verification(
  uuid,
  uuid,
  text,
  jsonb
)
to service_role;

comment on function
lead_engine.record_companies_house_verification(
  uuid,
  uuid,
  text,
  jsonb
)
is
  'Atomically records one founder-confirmed Companies House identity, company number, status and conservative subscriber classification. Browser roles cannot execute it.';
