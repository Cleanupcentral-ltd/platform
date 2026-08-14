-- Production corrective migration for the compliant Google bridge.
-- The first additive bridge was applied while the redesign branch was still
-- being built. Keep Google search paused, but make later qualification claims
-- prefer independently verified first-party website evidence before falling
-- back to transient Place Details re-resolution.

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
    coalesce(
      prospect.website_url,
      verified_site.website_url
    ) as website_url,
    prospect.company_number,
    case
      when coalesce(
        prospect.website_url,
        verified_site.website_url
      ) is not null then null
      else (
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
      )
    end as google_place_id,
    claimed.attempt_count
  from claimed
  join lead_engine.prospects as prospect
    on prospect.id = claimed.prospect_id
  left join lateral (
    select evidence.field_value as website_url
    from lead_engine.evidence as evidence
    where
      evidence.prospect_id = prospect.id and
      evidence.source_type = 'first_party_website' and
      evidence.field_name = 'website_url' and
      evidence.verification_status = 'verified' and
      evidence.field_value ~* '^https://'
    order by
      evidence.verified_at desc nulls last,
      evidence.captured_at desc,
      evidence.id desc
    limit 1
  ) as verified_site on true;
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
  'Claims existing Stage 4.2 jobs. A durable verified first-party website is preferred; the permitted Google Place ID is exposed only when transient Place Details re-resolution is still required.';
