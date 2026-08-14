-- Figma redesign: additive Google compliance bridge.
-- Google Places details remain transient; durable Google evidence remains Place ID only.
-- This migration deliberately does NOT re-enable Google search. Re-enablement is
-- a separate final migration after the backend and console are deployed.

create or replace function
lead_engine.resolve_google_prospect_ids(
  p_place_ids text[]
)
returns table (
  place_id text,
  prospect_id uuid
)
language sql
security invoker
set search_path = ''
as $resolve_google_prospect_ids$
  select
    substring(
      prospect.dedupe_key
      from char_length('google_places:') + 1
    ) as place_id,
    prospect.id as prospect_id
  from lead_engine.prospects as prospect
  where prospect.dedupe_key = any (
    select
      'google_places:' || place_id
    from unnest(p_place_ids) as place_id
    where
      place_id is not null and
      btrim(place_id) <> '' and
      length(place_id) <= 255
  );
$resolve_google_prospect_ids$;

revoke all on function
lead_engine.resolve_google_prospect_ids(text[])
from public, anon, authenticated;

grant execute on function
lead_engine.resolve_google_prospect_ids(text[])
to service_role;

comment on function
lead_engine.resolve_google_prospect_ids(text[]) is
  'Resolves permitted durable Google Place IDs to internal prospect IDs without exposing or storing Google Places business content.';

create or replace function
lead_engine.claim_automatic_qualification_jobs_v2(
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
  google_place_id text,
  attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $claim_automatic_qualification_jobs_v2$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception
      'automatic qualification batch size must be between 1 and 20'
      using errcode = '22023';
  end if;

  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception
      'automatic qualification lease must be between 30 and 900 seconds'
      using errcode = '22023';
  end if;

  return query
  with candidates as (
    select enrichment.prospect_id
    from lead_engine.company_enrichment as enrichment
    where enrichment.qualification_version =
        'stage_4_2_v1'
      and enrichment.qualification_state =
        'processing'
      and enrichment.actor_id is not null
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
      qualification_state = 'processing',
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
    prospect.sector,
    prospect.website_url,
    prospect.company_number,
    (
      select evidence.field_value
      from lead_engine.evidence as evidence
      where
        evidence.prospect_id = prospect.id and
        evidence.source_type = 'google_places' and
        evidence.field_name = 'google_place_id'
      order by
        evidence.captured_at desc,
        evidence.id desc
      limit 1
    ) as google_place_id,
    claimed.attempt_count
  from claimed
  join lead_engine.prospects as prospect
    on prospect.id = claimed.prospect_id;
end
$claim_automatic_qualification_jobs_v2$;

revoke all on function
lead_engine.claim_automatic_qualification_jobs_v2(
  integer,
  integer
)
from public, anon, authenticated;

grant execute on function
lead_engine.claim_automatic_qualification_jobs_v2(
  integer,
  integer
)
to service_role;

comment on function
lead_engine.claim_automatic_qualification_jobs_v2(integer, integer) is
  'Claims the existing Stage 4.2 qualification jobs and includes the permitted durable Google Place ID for transient Place Details re-resolution.';

create or replace function
lead_engine.promote_verified_google_prospect_identity(
  p_prospect_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $promote_verified_google_prospect_identity$
declare
  v_business_name text;
begin
  if not exists (
    select 1
    from lead_engine.prospects as prospect
    where
      prospect.id = p_prospect_id and
      prospect.dedupe_key like 'google_places:%'
  ) then
    return;
  end if;

  select evidence.field_value
  into v_business_name
  from lead_engine.evidence as evidence
  where
    evidence.prospect_id = p_prospect_id and
    evidence.source_type = 'first_party_website' and
    evidence.field_name = 'business_name' and
    evidence.verification_status = 'verified'
  order by
    evidence.verified_at desc nulls last,
    evidence.captured_at desc,
    evidence.id desc
  limit 1;

  if v_business_name is null then
    return;
  end if;

  -- business_name is safe to promote from verified first-party evidence.
  -- Do not update website_url here: that column has an enrichment refresh
  -- trigger and changing it during a claimed qualification would reset the
  -- in-flight job. The verified first-party website remains durable evidence,
  -- while future Google jobs re-resolve the live website transiently by Place ID.
  update lead_engine.prospects
  set
    business_name = v_business_name,
    updated_at = now()
  where id = p_prospect_id;
end
$promote_verified_google_prospect_identity$;

revoke all on function
lead_engine.promote_verified_google_prospect_identity(uuid)
from public, anon, authenticated;

grant execute on function
lead_engine.promote_verified_google_prospect_identity(uuid)
to service_role;

comment on function
lead_engine.promote_verified_google_prospect_identity(uuid) is
  'Promotes only the durable business name from independently verified first-party evidence for Google-discovered prospects; website_url remains evidence to avoid resetting the active qualification job.';
