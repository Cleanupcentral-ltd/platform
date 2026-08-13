drop function if exists
lead_engine.activate_automatic_qualification_v1();

create function
lead_engine.activate_automatic_qualification_v1(
  p_total_limit integer default 1
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $activate_automatic_qualification_v1$
declare
  v_activated integer;
  v_remaining integer;
begin
  if p_total_limit is not null and
    p_total_limit < 1
  then
    raise exception
      'automatic qualification rollout limit must be at least 1 or null for all'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'lead_engine.activate_automatic_qualification_v1',
      0
    )
  );

  if p_total_limit is null then
    v_remaining := null;
  else
    select greatest(
      p_total_limit - count(*)::integer,
      0
    )
    into v_remaining
    from lead_engine.company_enrichment
    where qualification_version =
      'stage_4_2_v1';

    if v_remaining = 0 then
      return 0;
    end if;
  end if;

  with selected as (
    select enrichment.prospect_id
    from lead_engine.company_enrichment
      as enrichment
    where enrichment.qualification_version
      is distinct from 'stage_4_2_v1'
    order by
      enrichment.created_at asc,
      enrichment.prospect_id asc
    for update skip locked
    limit v_remaining
  )
  update lead_engine.company_enrichment
    as enrichment
  set
    qualification_version = 'stage_4_2_v1',
    qualification_state = 'processing',
    qualification_reasons = '[]'::jsonb,
    research_summary = '{}'::jsonb,
    research_completed_at = null,
    status = 'pending',
    attempt_count = 0,
    available_at = now(),
    lease_expires_at = null,
    completed_at = null,
    last_error_code = null,
    updated_at = now()
  from selected
  where enrichment.prospect_id =
    selected.prospect_id;

  get diagnostics v_activated = row_count;
  return v_activated;
end
$activate_automatic_qualification_v1$;

revoke all on function
lead_engine.activate_automatic_qualification_v1(
  integer
)
from public, anon, authenticated;

grant execute on function
lead_engine.activate_automatic_qualification_v1(
  integer
)
to service_role;

comment on function
lead_engine.activate_automatic_qualification_v1(
  integer
) is
  'Admits prospects to Stage 4.2 without exceeding the configured total rollout limit. Null enables continuous admission for all current and future prospects; browser roles cannot execute it.';
