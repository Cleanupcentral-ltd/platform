create table lead_engine.lead_exports (
  id uuid primary key
    default gen_random_uuid(),
  founder_id uuid not null,
  row_count integer not null
    check (row_count >= 0),
  created_at timestamptz not null
    default now()
);

create index lead_exports_created_idx
on lead_engine.lead_exports (
  created_at desc,
  id desc
);

alter table lead_engine.lead_exports
enable row level security;

alter table lead_engine.lead_exports
force row level security;

revoke all on table
lead_engine.lead_exports
from public, anon, authenticated;

grant select, insert
on table lead_engine.lead_exports
to service_role;

create function
lead_engine.create_lead_export(
  p_founder_id uuid
)
returns table (
  prospect_reference uuid,
  business_name text,
  sector text,
  postcode text,
  website text,
  verified_contact_route text,
  eligibility_result text,
  total_score integer,
  rules_version text,
  status text,
  next_follow_up_at timestamptz,
  outcome text,
  source_urls text[],
  suppression_state boolean,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $create_lead_export$
declare
  v_row_count integer;
begin
  if p_founder_id is null then
    raise exception
      'founder is required for lead export'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_row_count
  from lead_engine.prospects;

  insert into lead_engine.lead_exports (
    founder_id,
    row_count
  ) values (
    p_founder_id,
    v_row_count
  );

  return query
  select
    prospect.id,
    prospect.business_name,
    prospect.sector,
    prospect.primary_postcode,
    prospect.website_url,
    verified_contact.contact_value,
    latest_assessment.eligibility_result,
    latest_assessment.total_score::integer,
    latest_assessment.rules_version,
    case
      when suppression.active
        then 'suppressed'
      when latest_outcome.outcome is not null
        then latest_outcome.outcome
      else coalesce(
        latest_draft.status,
        enrichment.qualification_state,
        prospect.contact_status,
        'research_required'
      )
    end,
    next_follow_up.follow_up_at,
    latest_outcome.outcome,
    coalesce(
      sources.source_urls,
      '{}'::text[]
    ),
    suppression.active,
    prospect.created_at
  from lead_engine.prospects
    as prospect
  left join lateral (
    select
      assessment.eligibility_result,
      assessment.total_score,
      assessment.rules_version
    from lead_engine.assessments
      as assessment
    where assessment.prospect_id =
      prospect.id
    order by
      assessment.assessed_at desc,
      assessment.id desc
    limit 1
  ) as latest_assessment on true
  left join lead_engine.company_enrichment
    as enrichment
    on enrichment.prospect_id =
      prospect.id
  left join lateral (
    select contact.contact_value
    from lead_engine.contacts
      as contact
    join lead_engine.evidence
      as source
      on source.id =
        contact.source_evidence_id
    where contact.prospect_id =
        prospect.id
      and contact.verification_status =
        'verified'
      and source.prospect_id =
        prospect.id
      and source.verification_status =
        'verified'
      and source.source_type =
        'first_party_website'
      and (
        (
          contact.contact_type = 'email' and
          source.field_name = 'public_email' and
          contact.normalized_value ~
            '^(admin|bookings|contact|enquiries|events|facilities|hello|info|office|reception|sales|support|team)([+._-][^@]*)?@[^@[:space:]]+\.[^@[:space:]]+$'
        ) or
        (
          contact.contact_type =
            'contact_form' and
          source.field_name =
            'contact_form_url'
        )
      )
    order by
      case
        when contact.contact_type = 'email'
          then 0
        else 1
      end,
      contact.is_primary desc,
      contact.created_at asc,
      contact.id asc
    limit 1
  ) as verified_contact on true
  left join lateral (
    select draft.status
    from lead_engine.outreach_drafts
      as draft
    where draft.prospect_id =
      prospect.id
    order by
      draft.created_at desc,
      draft.id desc
    limit 1
  ) as latest_draft on true
  left join lateral (
    select min(activity.follow_up_at)
      as follow_up_at
    from lead_engine.activities
      as activity
    where activity.prospect_id =
        prospect.id
      and activity.follow_up_at > now()
  ) as next_follow_up on true
  left join lateral (
    select activity.outcome
    from lead_engine.activities
      as activity
    where activity.prospect_id =
        prospect.id
      and activity.outcome is not null
    order by
      activity.created_at desc,
      activity.id desc
    limit 1
  ) as latest_outcome on true
  left join lateral (
    select array_agg(
      distinct evidence.source_url
      order by evidence.source_url
    ) as source_urls
    from lead_engine.evidence
      as evidence
    where evidence.prospect_id =
      prospect.id
  ) as sources on true
  cross join lateral (
    select exists (
      select 1
      from lead_engine.suppressions
        as blocked
      where blocked.lifted_at is null
        and (
          blocked.prospect_id =
            prospect.id or
          exists (
            select 1
            from lead_engine.contacts
              as blocked_contact
            where blocked_contact.prospect_id =
                prospect.id
              and (
                blocked.normalized_value =
                  blocked_contact.normalized_value or
                (
                  blocked.suppression_type =
                    'domain' and
                  blocked_contact.contact_type =
                    'email' and
                  blocked.normalized_value =
                    pg_catalog.split_part(
                      blocked_contact.normalized_value,
                      '@',
                      2
                    )
                )
              )
          )
        )
    ) as active
  ) as suppression
  order by
    prospect.created_at desc,
    prospect.id desc;
end
$create_lead_export$;

revoke all on function
lead_engine.create_lead_export(uuid)
from public, anon, authenticated;

grant execute on function
lead_engine.create_lead_export(uuid)
to service_role;

comment on table
lead_engine.lead_exports is
  'Founder-only audit of generated Lead Engine CSV files. The exported content is streamed by the backend and is not stored here.';

comment on function
lead_engine.create_lead_export(uuid) is
  'Records a founder export audit and returns current prospect, assessment, contact, activity, source and suppression state to the backend service role.';
