create unique index if not exists
evidence_prospect_snapshot_uidx
on lead_engine.evidence (
  prospect_id,
  content_sha256
)
where content_sha256 is not null;

drop function if exists
lead_engine.capture_lead_results(
  uuid,
  text,
  jsonb
);

create function lead_engine.capture_lead_results(
  p_search_run_id uuid,
  p_sector text,
  p_results jsonb
)
returns table (
  result_count integer,
  created_count integer,
  created_prospect_ids uuid[]
)
language plpgsql
security invoker
set search_path = ''
as $capture_lead_results$
declare
  result_item jsonb;
  evidence_item jsonb;
  v_prospect_id uuid;
  v_evidence_id uuid;
  inserted_rows integer;
  total_results integer;
  total_created integer := 0;
  v_created_prospect_ids uuid[] :=
    '{}'::uuid[];
begin
  if jsonb_typeof(p_results) <> 'array' then
    raise exception
      'p_results must be a JSON array'
      using errcode = '22023';
  end if;

  total_results := jsonb_array_length(p_results);

  if total_results > 20 then
    raise exception
      'p_results cannot contain more than 20 items'
      using errcode = '22023';
  end if;

  if p_search_run_id is not null then
    perform 1
    from lead_engine.search_runs
    where id = p_search_run_id
      and sector = p_sector
      and status = 'running'
    for update;

    if not found then
      raise exception
        'search run is missing, mismatched or not running'
        using errcode = '22023';
    end if;
  end if;

  for result_item in
    select value
    from jsonb_array_elements(p_results)
  loop
    v_prospect_id := null;

    insert into lead_engine.prospects (
      dedupe_key,
      business_name,
      sector,
      website_url,
      primary_postcode
    )
    values (
      result_item ->> 'dedupe_key',
      result_item ->> 'business_name',
      p_sector,
      nullif(result_item ->> 'website_url', ''),
      nullif(result_item ->> 'primary_postcode', '')
    )
    on conflict (dedupe_key) do nothing
    returning id into v_prospect_id;

    get diagnostics inserted_rows = row_count;

    if inserted_rows = 1 then
      total_created := total_created + 1;
      v_created_prospect_ids := array_append(
        v_created_prospect_ids,
        v_prospect_id
      );
    else
      select id
      into strict v_prospect_id
      from lead_engine.prospects
      where dedupe_key =
        result_item ->> 'dedupe_key';

      update lead_engine.prospects
      set
        business_name =
          result_item ->> 'business_name',
        website_url = coalesce(
          nullif(
            result_item ->> 'website_url',
            ''
          ),
          website_url
        ),
        primary_postcode = coalesce(
          nullif(
            result_item ->> 'primary_postcode',
            ''
          ),
          primary_postcode
        ),
        updated_at = now()
      where id = v_prospect_id;
    end if;

    if p_search_run_id is not null then
      insert into lead_engine.search_run_prospects (
        search_run_id,
        prospect_id,
        source_rank
      )
      values (
        p_search_run_id,
        v_prospect_id,
        (result_item ->> 'source_rank')::integer
      )
      on conflict (
        search_run_id,
        prospect_id
      ) do update
      set source_rank = least(
        lead_engine.search_run_prospects.source_rank,
        excluded.source_rank
      );
    end if;

    for evidence_item in
      select value
      from jsonb_array_elements(
        coalesce(
          result_item -> 'evidence',
          '[]'::jsonb
        )
      )
    loop
      v_evidence_id := null;

      insert into lead_engine.evidence (
        prospect_id,
        source_url,
        source_type,
        field_name,
        field_value,
        source_excerpt,
        content_sha256
      )
      values (
        v_prospect_id,
        evidence_item ->> 'source_url',
        evidence_item ->> 'source_type',
        evidence_item ->> 'field_name',
        evidence_item ->> 'field_value',
        nullif(
          evidence_item ->> 'source_excerpt',
          ''
        ),
        evidence_item ->> 'content_sha256'
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
        source_excerpt = excluded.source_excerpt
      returning id into v_evidence_id;

      if
        nullif(
          evidence_item ->> 'contact_type',
          ''
        ) is not null
        and nullif(
          evidence_item ->>
            'normalized_contact_value',
          ''
        ) is not null
      then
        insert into lead_engine.contacts (
          prospect_id,
          contact_type,
          contact_value,
          normalized_value,
          source_evidence_id
        )
        values (
          v_prospect_id,
          evidence_item ->> 'contact_type',
          evidence_item ->> 'field_value',
          evidence_item ->>
            'normalized_contact_value',
          v_evidence_id
        )
        on conflict (
          prospect_id,
          contact_type,
          normalized_value
        ) do update
        set
          contact_value = excluded.contact_value,
          source_evidence_id = excluded.source_evidence_id;
      end if;
    end loop;
  end loop;

  if p_search_run_id is not null then
    update lead_engine.search_runs
    set
      status = 'completed',
      result_count = total_results,
      completed_at = now()
    where id = p_search_run_id;
  end if;

  return query
  select
    total_results,
    total_created,
    v_created_prospect_ids;
end
$capture_lead_results$;

revoke all on function
lead_engine.capture_lead_results(
  uuid,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute on function
lead_engine.capture_lead_results(
  uuid,
  text,
  jsonb
)
to service_role;

comment on function
lead_engine.capture_lead_results(
  uuid,
  text,
  jsonb
)
is
  'Atomically captures up to 20 public lead results and returns only newly created prospect IDs for automatic assessment. Browser roles cannot execute it.';

with founder_actor as (
  select created_by as founder_id
  from lead_engine.search_runs
  order by created_at asc, id asc
  limit 1
), baseline_prospects as (
  select
    prospect.id,
    exists (
      select 1
      from lead_engine.search_run_prospects
      where prospect_id = prospect.id
    ) as has_search_provenance
  from lead_engine.prospects as prospect
  where not exists (
    select 1
    from lead_engine.assessments
    where prospect_id = prospect.id
  )
    and not exists (
      select 1
      from lead_engine.evidence
      where prospect_id = prospect.id
        and verification_status = 'verified'
    )
    and not exists (
      select 1
      from lead_engine.contacts
      where prospect_id = prospect.id
        and verification_status = 'verified'
    )
    and not exists (
      select 1
      from lead_engine.suppressions
      where prospect_id = prospect.id
        and lifted_at is null
    )
), baseline_assessments as (
  select
    baseline_prospect.id as prospect_id,
    founder_actor.founder_id,
    baseline_prospect.has_search_provenance,
    jsonb_build_array(
      'missing_verified_identity',
      'unverified_approved_sector'
    ) || case
      when baseline_prospect.has_search_provenance
        then '[]'::jsonb
      else jsonb_build_array(
        'missing_search_provenance'
      )
    end || jsonb_build_array(
      'active_status_unverified_or_inactive',
      'no_verified_contact_route',
      'unresolved_subscriber_type',
      'unapproved_email_basis'
    ) as blockers
  from baseline_prospects as baseline_prospect
  cross join founder_actor
)
insert into lead_engine.assessments (
  prospect_id,
  total_score,
  rules_version,
  eligibility_result,
  score_breakdown,
  blockers,
  rationale,
  evidence_ids,
  assessed_by
)
select
  baseline_assessment.prospect_id,
  2,
  'cuc-lel-0-10-v1',
  'research_required',
  jsonb_build_object(
    'sectorServiceFit', jsonb_build_object(
      'points', 1,
      'explanation',
        'Pilot-sector fit is plausible from discovery data but not yet verified.',
      'evidenceIds', '[]'::jsonb
    ),
    'recurringCleaningNeed', jsonb_build_object(
      'points', 1,
      'explanation',
        'Only the sector-level recurring cleaning need is currently supported.',
      'evidenceIds', '[]'::jsonb
    ),
    'portfolioOrPremisesScale', jsonb_build_object(
      'points', 0,
      'explanation',
        'Premises or portfolio scale remains unknown.',
      'evidenceIds', '[]'::jsonb
    ),
    'compliantContactability', jsonb_build_object(
      'points', 0,
      'explanation',
        'No compliant verified public contact route is available.',
      'evidenceIds', '[]'::jsonb
    ),
    'evidenceConfidence', jsonb_build_object(
      'points', 0,
      'explanation',
        'Persistent evidence is unsupported or not yet verified.',
      'evidenceIds', '[]'::jsonb
    )
  ),
  baseline_assessment.blockers,
  'Research required. Score 2/10 does not override ' ||
    jsonb_array_length(
      baseline_assessment.blockers
    )::text ||
    ' qualification blockers.',
  '{}'::uuid[],
  baseline_assessment.founder_id
from baseline_assessments as baseline_assessment;

comment on column
lead_engine.assessments.rules_version
is
  'Immutable assessment rule version. Automatic recalculation appends a new assessment; it never overwrites an earlier version.';
