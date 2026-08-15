create or replace function
lead_engine.record_manual_outreach_activity(
  p_prospect_id uuid,
  p_founder_id uuid,
  p_activity_type text,
  p_outcome text,
  p_notes text,
  p_follow_up_at timestamptz
)
returns table (
  id uuid,
  activity_type text,
  outcome text,
  notes text,
  follow_up_at timestamptz,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $record_manual_outreach_activity$
declare
  v_activity_id uuid;
begin
  if p_activity_type not in (
    'contacted',
    'replied',
    'follow_up_scheduled',
    'outcome'
  ) then
    raise exception
      'invalid manual outreach activity'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from lead_engine.prospects
      as prospect
    where prospect.id = p_prospect_id
  ) then
    raise exception
      'prospect not found'
      using errcode = 'P0002';
  end if;

  if p_notes is not null and
    length(p_notes) > 1000
  then
    raise exception
      'outreach note is too long'
      using errcode = '22023';
  end if;

  if p_activity_type =
      'follow_up_scheduled' and
    (
      p_follow_up_at is null or
      p_follow_up_at <= now()
    )
  then
    raise exception
      'follow-up must be scheduled in the future'
      using errcode = '22023';
  end if;

  if p_activity_type = 'outcome' and
    p_outcome not in (
      'won',
      'lost',
      'not_now',
      'interested',
      'not_interested',
      'no_response',
      'invalid_contact',
      'do_not_contact'
    )
  then
    raise exception
      'invalid outreach outcome'
      using errcode = '22023';
  end if;

  -- Preserve the legacy reply guard. The simplified founder Log Contact
  -- form records its selected outcome directly, so it does not require a
  -- separate synthetic "contacted" row first.
  if p_activity_type = 'replied' and
    not exists (
      select 1
      from lead_engine.activities
        as contacted_activity
      where contacted_activity.prospect_id =
          p_prospect_id
        and contacted_activity.activity_type =
          'contacted'
    )
  then
    raise exception
      'contacted must be recorded first'
      using errcode = '22023';
  end if;

  -- Keep the original sequencing rule for legacy close/revisit outcomes.
  -- The new founder contact outcomes are themselves explicit contact logs.
  if p_activity_type = 'outcome' and
    p_outcome in (
      'won',
      'lost',
      'not_now'
    ) and
    not exists (
      select 1
      from lead_engine.activities
        as contacted_activity
      where contacted_activity.prospect_id =
          p_prospect_id
        and contacted_activity.activity_type =
          'contacted'
    )
  then
    raise exception
      'contacted must be recorded before this legacy outreach outcome'
      using errcode = '22023';
  end if;

  insert into lead_engine.activities (
    prospect_id,
    activity_type,
    outcome,
    notes,
    follow_up_at,
    created_by
  ) values (
    p_prospect_id,
    p_activity_type,
    p_outcome,
    p_notes,
    p_follow_up_at,
    p_founder_id
  )
  returning activities.id
    into v_activity_id;

  if p_activity_type = 'outcome' and
    p_outcome = 'do_not_contact'
  then
    insert into lead_engine.suppressions (
      prospect_id,
      suppression_type,
      normalized_value,
      reason,
      source,
      created_by
    ) values (
      p_prospect_id,
      'business',
      p_prospect_id::text,
      coalesce(
        nullif(trim(p_notes), ''),
        'Founder recorded do not contact'
      ),
      'founder_outreach_outcome',
      p_founder_id
    )
    on conflict (
      suppression_type,
      normalized_value
    ) where lifted_at is null
    do nothing;
  end if;

  return query
  select
    activity.id,
    activity.activity_type,
    activity.outcome,
    activity.notes,
    activity.follow_up_at,
    activity.created_at
  from lead_engine.activities
    as activity
  where activity.id = v_activity_id;
end
$record_manual_outreach_activity$;

revoke all on function
lead_engine.record_manual_outreach_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
)
from public, anon, authenticated;

grant execute on function
lead_engine.record_manual_outreach_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
)
to service_role;

comment on function
lead_engine.record_manual_outreach_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
) is
  'Records founder-confirmed manual contact activity. Supports Interested, Not Interested, No Response, Follow-Up Required, Invalid Contact and Do Not Contact without fabricating an Outlook send. Do-not-contact outcomes create durable suppression.';
