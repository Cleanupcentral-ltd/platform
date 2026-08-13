alter table lead_engine.evidence
add column verification_method text not null
  default 'founder_review'
  check (
    verification_method in (
      'founder_review',
      'automatic_first_party_company_number'
    )
  );

comment on column
lead_engine.evidence.verification_method is
  'Distinguishes founder-reviewed facts from the narrowly approved automatic first-party company-number verification path.';

create table lead_engine.company_enrichment (
  prospect_id uuid primary key
    references lead_engine.prospects(id)
    on delete restrict,
  actor_id uuid,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'auto_verified',
        'review_required',
        'no_match',
        'duplicate',
        'failed',
        'verified_existing'
      )
    ),
  discovered_company_number text
    check (
      discovered_company_number is null or
      discovered_company_number ~ '^[A-Z0-9]{6,12}$'
    ),
  source_url text
    check (
      source_url is null or
      source_url ~* '^https://'
    ),
  source_excerpt text,
  source_content_sha256 text
    check (
      source_content_sha256 is null or
      source_content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  candidates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(candidates) = 'array'),
  last_error_code text,
  attempt_count integer not null default 0
    check (attempt_count between 0 and 10),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'auto_verified' or
    (
      discovered_company_number is not null and
      source_url is not null and
      source_content_sha256 is not null
    )
  )
);

create index company_enrichment_claimable_idx
on lead_engine.company_enrichment (
  available_at,
  created_at,
  prospect_id
)
where actor_id is not null
  and attempt_count < 3
  and status in (
    'pending',
    'failed',
    'processing'
  );

alter table lead_engine.company_enrichment
enable row level security;

alter table lead_engine.company_enrichment
force row level security;

create policy founder_mfa_guard
on lead_engine.company_enrichment
for all
to authenticated
using (
  ((select auth.jwt()) ->> 'aal') = 'aal2' and
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'founder'
)
with check (
  ((select auth.jwt()) ->> 'aal') = 'aal2' and
  ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'founder'
);

revoke all on table
lead_engine.company_enrichment
from public, anon, authenticated;

grant select, insert, update, delete
on table lead_engine.company_enrichment
to service_role;

create or replace function
lead_engine.refresh_company_enrichment_job()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $refresh_company_enrichment_job$
begin
  insert into lead_engine.company_enrichment (
    prospect_id,
    status,
    completed_at
  )
  values (
    new.id,
    case
      when new.company_number is null
        then 'pending'
      else 'verified_existing'
    end,
    case
      when new.company_number is null
        then null
      else now()
    end
  )
  on conflict (prospect_id)
  do update
  set
    status = case
      when new.company_number is not null
        then 'verified_existing'
      when old.website_url is distinct from
        new.website_url
        then 'pending'
      else lead_engine.company_enrichment.status
    end,
    attempt_count = case
      when old.website_url is distinct from
        new.website_url and
        new.company_number is null
        then 0
      else lead_engine.company_enrichment.attempt_count
    end,
    available_at = case
      when old.website_url is distinct from
        new.website_url and
        new.company_number is null
        then now()
      else lead_engine.company_enrichment.available_at
    end,
    completed_at = case
      when new.company_number is not null
        then now()
      when old.website_url is distinct from
        new.website_url
        then null
      else lead_engine.company_enrichment.completed_at
    end,
    updated_at = now();

  return new;
end
$refresh_company_enrichment_job$;

create trigger refresh_company_enrichment_job
after insert or update of website_url, company_number
on lead_engine.prospects
for each row
execute function
lead_engine.refresh_company_enrichment_job();

create or replace function
lead_engine.attach_company_enrichment_actor_from_search()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $attach_company_enrichment_actor_from_search$
begin
  update lead_engine.company_enrichment
  set
    actor_id = coalesce(
      actor_id,
      (
        select created_by
        from lead_engine.search_runs
        where id = new.search_run_id
      )
    ),
    updated_at = now()
  where prospect_id = new.prospect_id;

  return new;
end
$attach_company_enrichment_actor_from_search$;

create trigger attach_company_enrichment_actor_from_search
after insert
on lead_engine.search_run_prospects
for each row
execute function
lead_engine.attach_company_enrichment_actor_from_search();

create or replace function
lead_engine.attach_company_enrichment_actor_from_assessment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $attach_company_enrichment_actor_from_assessment$
begin
  update lead_engine.company_enrichment
  set
    actor_id = coalesce(actor_id, new.assessed_by),
    updated_at = now()
  where prospect_id = new.prospect_id;

  return new;
end
$attach_company_enrichment_actor_from_assessment$;

create trigger attach_company_enrichment_actor_from_assessment
after insert
on lead_engine.assessments
for each row
execute function
lead_engine.attach_company_enrichment_actor_from_assessment();

insert into lead_engine.company_enrichment (
  prospect_id,
  actor_id,
  status,
  completed_at
)
select
  prospect.id,
  coalesce(
    (
      select assessment.assessed_by
      from lead_engine.assessments as assessment
      where assessment.prospect_id = prospect.id
      order by
        assessment.assessed_at desc,
        assessment.id desc
      limit 1
    ),
    (
      select search_run.created_by
      from lead_engine.search_run_prospects as link
      join lead_engine.search_runs as search_run
        on search_run.id = link.search_run_id
      where link.prospect_id = prospect.id
      order by
        search_run.created_at asc,
        search_run.id asc
      limit 1
    )
  ),
  case
    when prospect.company_number is null
      then 'pending'
    else 'verified_existing'
  end,
  case
    when prospect.company_number is null
      then null
    else now()
  end
from lead_engine.prospects as prospect
on conflict (prospect_id) do nothing;

create or replace function
lead_engine.claim_company_enrichment_jobs(
  p_limit integer,
  p_lease_seconds integer
)
returns table (
  prospect_id uuid,
  actor_id uuid,
  business_name text,
  website_url text,
  company_number text,
  attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $claim_company_enrichment_jobs$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception
      'company enrichment batch size must be between 1 and 20'
      using errcode = '22023';
  end if;

  if p_lease_seconds < 30 or
    p_lease_seconds > 900
  then
    raise exception
      'company enrichment lease must be between 30 and 900 seconds'
      using errcode = '22023';
  end if;

  return query
  with candidates as (
    select enrichment.prospect_id
    from lead_engine.company_enrichment as enrichment
    where enrichment.actor_id is not null
      and enrichment.attempt_count < 3
      and enrichment.available_at <= now()
      and (
        enrichment.status in ('pending', 'failed') or
        (
          enrichment.status = 'processing' and
          enrichment.lease_expires_at < now()
        )
      )
    order by
      enrichment.available_at asc,
      enrichment.created_at asc,
      enrichment.prospect_id asc
    for update skip locked
    limit p_limit
  ), claimed as (
    update lead_engine.company_enrichment as enrichment
    set
      status = 'processing',
      attempt_count = enrichment.attempt_count + 1,
      last_attempt_at = now(),
      lease_expires_at = now() +
        make_interval(secs => p_lease_seconds),
      last_error_code = null,
      updated_at = now()
    from candidates
    where enrichment.prospect_id =
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
    prospect.website_url,
    prospect.company_number,
    claimed.attempt_count
  from claimed
  join lead_engine.prospects as prospect
    on prospect.id = claimed.prospect_id;
end
$claim_company_enrichment_jobs$;

revoke all on function
lead_engine.claim_company_enrichment_jobs(
  integer,
  integer
)
from public, anon, authenticated;

grant execute on function
lead_engine.claim_company_enrichment_jobs(
  integer,
  integer
)
to service_role;

create or replace function
lead_engine.retry_company_enrichment(
  p_prospect_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $retry_company_enrichment$
begin
  update lead_engine.company_enrichment
  set
    actor_id = p_actor_id,
    status = 'pending',
    attempt_count = 0,
    available_at = now(),
    lease_expires_at = null,
    completed_at = null,
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

revoke all on function
lead_engine.retry_company_enrichment(
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute on function
lead_engine.retry_company_enrichment(
  uuid,
  uuid
)
to service_role;

create or replace function
lead_engine.record_automatic_companies_house_verification(
  p_prospect_id uuid,
  p_actor_id uuid,
  p_attempt_count integer,
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
as $record_automatic_companies_house_verification$
declare
  v_company_number text;
  v_official_evidence_ids uuid[];
  v_website_evidence_id uuid;
  v_job_actor_id uuid;
  v_job_status text;
  v_job_attempt_count integer;
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
  for update;

  if not found or
    v_job_actor_id is distinct from p_actor_id or
    v_job_status <> 'processing' or
    v_job_attempt_count <> p_attempt_count
  then
    raise exception
      'stale company enrichment claim'
      using errcode = '40001';
  end if;

  if p_website_source_url !~* '^https://' or
    p_website_content_sha256 !~ '^[0-9a-f]{64}$' or
    nullif(btrim(p_website_source_excerpt), '') is null
  then
    raise exception
      'invalid first-party company-number evidence'
      using errcode = '22023';
  end if;

  select item ->> 'field_value'
  into v_company_number
  from jsonb_array_elements(p_facts) as item
  where item ->> 'field_name' = 'company_number';

  if v_company_number !~ '^[A-Z0-9]{6,12}$' or
    position(
      v_company_number in upper(
        replace(p_website_source_excerpt, ' ', '')
      )
    ) = 0
  then
    raise exception
      'first-party evidence does not contain the verified company number'
      using errcode = '22023';
  end if;

  select verification.evidence_ids
  into v_official_evidence_ids
  from lead_engine.record_companies_house_verification(
    p_prospect_id,
    p_actor_id,
    p_companies_house_source_url,
    p_facts
  ) as verification;

  select evidence.evidence_id
  into v_website_evidence_id
  from lead_engine.record_verified_lead_evidence(
    p_prospect_id,
    p_actor_id,
    'first_party_website',
    p_website_source_url,
    'company_number',
    v_company_number,
    p_website_source_excerpt,
    p_website_content_sha256,
    null,
    null
  ) as evidence;

  update lead_engine.evidence
  set verification_method =
    'automatic_first_party_company_number'
  where id = any(
    array_append(
      v_official_evidence_ids,
      v_website_evidence_id
    )
  );

  update lead_engine.company_enrichment
  set
    status = 'auto_verified',
    discovered_company_number = v_company_number,
    source_url = p_website_source_url,
    source_excerpt = p_website_source_excerpt,
    source_content_sha256 = p_website_content_sha256,
    candidates = '[]'::jsonb,
    last_error_code = null,
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where prospect_id = p_prospect_id;

  return query
  select array_append(
    v_official_evidence_ids,
    v_website_evidence_id
  );
end
$record_automatic_companies_house_verification$;

revoke all on function
lead_engine.record_automatic_companies_house_verification(
  uuid,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute on function
lead_engine.record_automatic_companies_house_verification(
  uuid,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  jsonb
)
to service_role;

comment on table
lead_engine.company_enrichment is
  'Private persisted Companies House enrichment queue. Only an exact labelled company number from the captured first-party website may be accepted automatically; name-search candidates remain founder review exceptions.';

comment on function
lead_engine.record_automatic_companies_house_verification(
  uuid,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  jsonb
)
is
  'Atomically records the approved automatic path: one labelled company number from a first-party HTTPS page plus the matching official Companies House profile. Browser roles cannot execute it.';
