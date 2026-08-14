alter table lead_engine.company_enrichment
add column if not exists
  founder_priority_requested_at timestamptz;

create index if not exists
  company_enrichment_founder_priority_idx
on lead_engine.company_enrichment (
  founder_priority_requested_at
)
where founder_priority_requested_at is not null;

create or replace function
lead_engine.retry_company_enrichment(
  p_prospect_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
set search_path = ''
as $retry_company_enrichment$
begin
  update lead_engine.company_enrichment
  set
    actor_id = p_actor_id,
    status = 'pending',
    qualification_state = case
      when qualification_version =
        'stage_4_2_v1'
        then 'processing'
      else qualification_state
    end,
    qualification_reasons = case
      when qualification_version =
        'stage_4_2_v1'
        then '[]'::jsonb
      else qualification_reasons
    end,
    attempt_count = 0,
    available_at = now(),
    founder_priority_requested_at =
      case
        when qualification_version =
          'stage_4_2_v1'
          then now()
        else null
      end,
    lease_expires_at = null,
    completed_at = null,
    research_completed_at = case
      when qualification_version =
        'stage_4_2_v1'
        then null
      else research_completed_at
    end,
    last_error_code = null,
    updated_at = now()
  where prospect_id = p_prospect_id;

  if not found then
    raise exception
      'prospect enrichment not found'
      using errcode = 'P0002';
  end if;
end
$retry_company_enrichment$;

create or replace function
lead_engine.claim_automatic_qualification_jobs(
  p_limit integer,
  p_lease_seconds integer
)
returns table (
  prospect_id uuid,
  actor_id uuid,
  business_name text,
  sector text,
  website_url text,
  company_number text,
  attempt_count integer
)
language plpgsql
set search_path = ''
as $claim_automatic_qualification_jobs$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception
      'automatic qualification batch size must be between 1 and 20'
      using errcode = '22023';
  end if;

  if
    p_lease_seconds < 30 or
    p_lease_seconds > 900
  then
    raise exception
      'automatic qualification lease must be between 30 and 900 seconds'
      using errcode = '22023';
  end if;

  return query
  with candidates as (
    select enrichment.prospect_id
    from
      lead_engine.company_enrichment
        as enrichment
    where
      enrichment.qualification_version =
        'stage_4_2_v1'
      and enrichment.qualification_state =
        'processing'
      and enrichment.actor_id is not null
      and enrichment.attempt_count < 3
      and enrichment.available_at <= now()
      and (
        enrichment.status in (
          'pending',
          'failed'
        ) or
        (
          enrichment.status =
            'processing' and
          enrichment.lease_expires_at <
            now()
        )
      )
    order by
      (
        enrichment
          .founder_priority_requested_at
          is null
      ) asc,
      enrichment
        .founder_priority_requested_at
        asc nulls last,
      enrichment.available_at asc,
      enrichment.created_at asc,
      enrichment.prospect_id asc
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update
      lead_engine.company_enrichment
        as enrichment
    set
      status = 'processing',
      qualification_state =
        'processing',
      attempt_count =
        enrichment.attempt_count + 1,
      last_attempt_at = now(),
      lease_expires_at =
        now() +
        make_interval(
          secs => p_lease_seconds
        ),
      founder_priority_requested_at =
        null,
      last_error_code = null,
      updated_at = now()
    from candidates
    where
      enrichment.prospect_id =
        candidates.prospect_id
    returning
      enrichment.prospect_id,
      enrichment.actor_id,
      enrichment.attempt_count
  )
  select
    claimed.prospect_id,
    claimed.actor_id,
    prospect.business_name,
    prospect.sector,
    prospect.website_url,
    prospect.company_number,
    claimed.attempt_count
  from claimed
  join lead_engine.prospects as prospect
    on prospect.id =
      claimed.prospect_id;
end
$claim_automatic_qualification_jobs$;
