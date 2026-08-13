alter table lead_engine.outreach_drafts
add column contact_id uuid
  references lead_engine.contacts(id)
  on delete restrict,
add column recipient_email text,
add column template_id text not null
  default 'initial_outreach_v1',
add column preview_sha256 text,
add column outlook_web_url text,
add column last_error_code text;

alter table lead_engine.outreach_drafts
add constraint outreach_drafts_recipient_email_check
check (
  recipient_email is null or
  recipient_email = lower(recipient_email)
) not valid,
add constraint outreach_drafts_preview_sha256_check
check (
  preview_sha256 is null or
  preview_sha256 ~ '^[0-9a-f]{64}$'
) not valid,
add constraint outreach_drafts_outlook_web_url_check
check (
  outlook_web_url is null or
  outlook_web_url ~* '^https://'
) not valid;

create unique index
outreach_drafts_open_contact_template_uidx
on lead_engine.outreach_drafts (
  prospect_id,
  contact_id,
  template_id
)
where contact_id is not null
  and status in (
    'pending',
    'drafted',
    'failed',
    'contacted',
    'replied'
  );

create table lead_engine.outlook_connections (
  founder_id uuid primary key,
  mailbox_email text not null
    check (
      mailbox_email = lower(mailbox_email)
    ),
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_expires_at timestamptz not null,
  scope text not null
    check (
      scope ~* '(^|[[:space:]/])mail\.readwrite([[:space:]]|$)' and
      scope !~* '(^|[[:space:]/])mail\.send([[:space:]]|$)'
    ),
  connected_at timestamptz not null
    default now(),
  updated_at timestamptz not null
    default now()
);

create table lead_engine.outlook_oauth_states (
  state_hash text primary key
    check (
      state_hash ~ '^[0-9a-f]{64}$'
    ),
  founder_id uuid not null,
  encrypted_verifier text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null
    default now()
);

create index outlook_oauth_states_expiry_idx
on lead_engine.outlook_oauth_states (
  expires_at
)
where consumed_at is null;

alter table lead_engine.outlook_connections
enable row level security;

alter table lead_engine.outlook_connections
force row level security;

alter table lead_engine.outlook_oauth_states
enable row level security;

alter table lead_engine.outlook_oauth_states
force row level security;

revoke all on table
lead_engine.outlook_connections,
lead_engine.outlook_oauth_states
from public, anon, authenticated;

grant select, insert, update, delete
on table
lead_engine.outlook_connections,
lead_engine.outlook_oauth_states
to service_role;

create function
lead_engine.consume_outlook_oauth_state(
  p_state_hash text
)
returns table (
  founder_id uuid,
  encrypted_verifier text
)
language plpgsql
security invoker
set search_path = ''
as $consume_outlook_oauth_state$
begin
  if p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception
      'invalid Outlook OAuth state'
      using errcode = '22023';
  end if;

  return query
  update lead_engine.outlook_oauth_states
    as oauth_state
  set consumed_at = now()
  where oauth_state.state_hash =
      p_state_hash
    and oauth_state.consumed_at is null
    and oauth_state.expires_at > now()
  returning
    oauth_state.founder_id,
    oauth_state.encrypted_verifier;

  if not found then
    raise exception
      'Outlook OAuth state is invalid, expired or already used'
      using errcode = 'P0002';
  end if;
end
$consume_outlook_oauth_state$;

revoke all on function
lead_engine.consume_outlook_oauth_state(text)
from public, anon, authenticated;

grant execute on function
lead_engine.consume_outlook_oauth_state(text)
to service_role;

create function
lead_engine.get_latest_outreach_draft(
  p_prospect_id uuid
)
returns table (
  id uuid,
  prospect_id uuid,
  contact_id uuid,
  recipient_email text,
  subject text,
  body text,
  template_id text,
  preview_sha256 text,
  evidence_ids uuid[],
  status text,
  outlook_draft_id text,
  outlook_web_url text,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $get_latest_outreach_draft$
  select
    draft.id,
    draft.prospect_id,
    draft.contact_id,
    draft.recipient_email,
    draft.subject,
    draft.body,
    draft.template_id,
    draft.preview_sha256,
    coalesce(
      array_agg(
        link.evidence_id
        order by link.evidence_id
      ) filter (
        where link.evidence_id is not null
      ),
      '{}'::uuid[]
    ) as evidence_ids,
    draft.status,
    draft.outlook_draft_id,
    draft.outlook_web_url,
    draft.last_error_code,
    draft.created_at,
    draft.updated_at
  from lead_engine.outreach_drafts
    as draft
  left join lead_engine.outreach_draft_evidence
    as link
    on link.outreach_draft_id = draft.id
  where draft.prospect_id = p_prospect_id
    and draft.contact_id is not null
    and draft.recipient_email is not null
    and draft.preview_sha256 is not null
  group by draft.id
  order by
    draft.created_at desc,
    draft.id desc
  limit 1
$get_latest_outreach_draft$;

revoke all on function
lead_engine.get_latest_outreach_draft(uuid)
from public, anon, authenticated;

grant execute on function
lead_engine.get_latest_outreach_draft(uuid)
to service_role;

create function
lead_engine.prepare_outlook_draft(
  p_prospect_id uuid,
  p_founder_id uuid,
  p_contact_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text,
  p_template_id text,
  p_preview_sha256 text,
  p_evidence_ids uuid[]
)
returns table (
  id uuid,
  prospect_id uuid,
  contact_id uuid,
  recipient_email text,
  subject text,
  body text,
  template_id text,
  preview_sha256 text,
  evidence_ids uuid[],
  status text,
  outlook_draft_id text,
  outlook_web_url text,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $prepare_outlook_draft$
declare
  v_draft_id uuid;
  v_evidence_ids uuid[];
  v_latest_eligibility text;
  v_latest_blockers jsonb;
begin
  if p_template_id <>
    'initial_outreach_v1' or
    length(p_subject) not between 1 and 200 or
    length(p_body) not between 1 and 5000 or
    p_preview_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception
      'invalid outreach draft payload'
      using errcode = '22023';
  end if;

  p_recipient_email :=
    lower(trim(p_recipient_email));
  if p_recipient_email !~
    '^(admin|bookings|contact|enquiries|events|facilities|hello|info|office|reception|sales|support|team)([+._-][^@]*)?@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception
      'only a verified generic business email can receive a draft'
      using errcode = '22023';
  end if;

  v_evidence_ids := array(
    select distinct evidence_id
    from unnest(p_evidence_ids)
      as evidence_id
    order by evidence_id
  );
  if cardinality(v_evidence_ids) = 0 then
    raise exception
      'outreach draft requires linked evidence'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_prospect_id::text || ':' ||
      p_contact_id::text || ':' ||
      p_template_id,
      0
    )
  );

  if not exists (
    select 1
    from lead_engine.contacts as contact
    join lead_engine.evidence as source
      on source.id =
        contact.source_evidence_id
    where contact.id = p_contact_id
      and contact.prospect_id =
        p_prospect_id
      and contact.contact_type = 'email'
      and contact.verification_status =
        'verified'
      and contact.normalized_value =
        p_recipient_email
      and source.prospect_id =
        p_prospect_id
      and source.field_name =
        'public_email'
      and source.verification_status =
        'verified'
      and source.source_type =
        'first_party_website'
  ) then
    raise exception
      'outreach contact is not verified'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from lead_engine.evidence
      as subscriber_evidence
    where subscriber_evidence.prospect_id =
        p_prospect_id
      and subscriber_evidence.field_name =
        'subscriber_type'
      and subscriber_evidence.field_value =
        'corporate'
      and subscriber_evidence.verification_status =
        'verified'
      and subscriber_evidence.source_type in (
        'first_party_website',
        'companies_house'
      )
  ) then
    raise exception
      'corporate subscriber evidence is required'
      using errcode = '22023';
  end if;

  select
    assessment.eligibility_result,
    assessment.blockers
  into
    v_latest_eligibility,
    v_latest_blockers
  from lead_engine.assessments
    as assessment
  where assessment.prospect_id =
    p_prospect_id
  order by
    assessment.assessed_at desc,
    assessment.id desc
  limit 1;

  if
    v_latest_eligibility is distinct from
      'eligible' or
    v_latest_blockers is distinct from
      '[]'::jsonb
  then
    raise exception
      'latest assessment is not eligible'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from lead_engine.company_enrichment
      as enrichment
    where enrichment.prospect_id =
        p_prospect_id
      and enrichment.qualification_version =
        'stage_4_2_v1'
      and enrichment.qualification_state =
        'ready_for_outreach'
  ) then
    raise exception
      'prospect is not in the ready queue'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from lead_engine.suppressions
      as suppression
    where suppression.lifted_at is null
      and (
        suppression.prospect_id =
          p_prospect_id or
        suppression.normalized_value =
          p_recipient_email or
        suppression.normalized_value =
          pg_catalog.split_part(
            p_recipient_email,
            '@',
            2
          )
      )
  ) then
    raise exception
      'prospect is suppressed'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from lead_engine.evidence
      as draft_evidence
    where draft_evidence.id =
        any(v_evidence_ids)
      and draft_evidence.prospect_id =
        p_prospect_id
      and draft_evidence.verification_status =
        'verified'
      and draft_evidence.source_type in (
        'first_party_website',
        'companies_house'
      )
  ) <> cardinality(v_evidence_ids)
  then
    raise exception
      'draft evidence is incomplete or unsupported'
      using errcode = '22023';
  end if;

  select draft.id
  into v_draft_id
  from lead_engine.outreach_drafts
    as draft
  where draft.prospect_id =
      p_prospect_id
    and draft.contact_id = p_contact_id
    and draft.template_id =
      p_template_id
    and draft.status in (
      'pending',
      'drafted',
      'failed',
      'contacted',
      'replied'
    )
  order by
    draft.created_at desc,
    draft.id desc
  limit 1
  for update;

  if v_draft_id is null then
    insert into lead_engine.outreach_drafts (
      prospect_id,
      contact_id,
      recipient_email,
      subject,
      body,
      template_id,
      preview_sha256,
      status,
      created_by
    ) values (
      p_prospect_id,
      p_contact_id,
      p_recipient_email,
      p_subject,
      p_body,
      p_template_id,
      p_preview_sha256,
      'pending',
      p_founder_id
    )
    returning outreach_drafts.id
      into v_draft_id;
  end if;

  insert into
    lead_engine.outreach_draft_evidence (
      outreach_draft_id,
      evidence_id
    )
  select
    v_draft_id,
    evidence_id
  from unnest(v_evidence_ids)
    as evidence_id
  on conflict do nothing;

  return query
  select *
  from lead_engine.get_latest_outreach_draft(
    p_prospect_id
  ) as latest
  where latest.id = v_draft_id;
end
$prepare_outlook_draft$;

revoke all on function
lead_engine.prepare_outlook_draft(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid[]
)
from public, anon, authenticated;

grant execute on function
lead_engine.prepare_outlook_draft(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid[]
)
to service_role;

create function
lead_engine.mark_outlook_draft_created(
  p_draft_id uuid,
  p_founder_id uuid,
  p_outlook_draft_id text,
  p_outlook_web_url text
)
returns table (
  id uuid,
  prospect_id uuid,
  contact_id uuid,
  recipient_email text,
  subject text,
  body text,
  template_id text,
  preview_sha256 text,
  evidence_ids uuid[],
  status text,
  outlook_draft_id text,
  outlook_web_url text,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $mark_outlook_draft_created$
declare
  v_prospect_id uuid;
  v_existing_outlook_id text;
  v_previous_status text;
begin
  if length(p_outlook_draft_id) not between
      1 and 1000 or
    (
      p_outlook_web_url is not null and
      p_outlook_web_url !~* '^https://'
    )
  then
    raise exception
      'invalid Outlook draft reference'
      using errcode = '22023';
  end if;

  select
    draft.prospect_id,
    draft.outlook_draft_id,
    draft.status
  into
    v_prospect_id,
    v_existing_outlook_id,
    v_previous_status
  from lead_engine.outreach_drafts
    as draft
  where draft.id = p_draft_id
  for update;

  if not found then
    raise exception
      'outreach draft not found'
      using errcode = 'P0002';
  end if;

  if
    v_existing_outlook_id is not null and
    v_existing_outlook_id <>
      p_outlook_draft_id
  then
    raise exception
      'outreach draft already has a different Outlook reference'
      using errcode = '23505';
  end if;

  update lead_engine.outreach_drafts
  set
    status = 'drafted',
    outlook_draft_id =
      p_outlook_draft_id,
    outlook_web_url =
      p_outlook_web_url,
    last_error_code = null,
    updated_at = now()
  where outreach_drafts.id =
    p_draft_id;

  if v_previous_status <> 'drafted' then
    insert into lead_engine.activities (
      prospect_id,
      activity_type,
      notes,
      created_by
    ) values (
      v_prospect_id,
      'outlook_draft_created',
      'Initial outreach draft created in Outlook. This is not a contacted event.',
      p_founder_id
    );
  end if;

  return query
  select *
  from lead_engine.get_latest_outreach_draft(
    v_prospect_id
  ) as latest
  where latest.id = p_draft_id;
end
$mark_outlook_draft_created$;

revoke all on function
lead_engine.mark_outlook_draft_created(
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated;

grant execute on function
lead_engine.mark_outlook_draft_created(
  uuid,
  uuid,
  text,
  text
)
to service_role;

create function
lead_engine.record_outreach_activity(
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
as $record_outreach_activity$
declare
  v_activity_id uuid;
  v_draft_id uuid;
  v_draft_status text;
begin
  if p_activity_type not in (
    'contacted',
    'replied',
    'follow_up_scheduled',
    'outcome'
  ) then
    raise exception
      'invalid outreach activity'
      using errcode = '22023';
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
      'not_interested',
      'do_not_contact'
    )
  then
    raise exception
      'invalid outreach outcome'
      using errcode = '22023';
  end if;

  select draft.id, draft.status
  into v_draft_id, v_draft_status
  from lead_engine.outreach_drafts
    as draft
  where draft.prospect_id =
      p_prospect_id
    and draft.outlook_draft_id is not null
  order by
    draft.created_at desc,
    draft.id desc
  limit 1
  for update;

  if not found then
    raise exception
      'a created Outlook draft is required'
      using errcode = '22023';
  end if;

  if p_activity_type = 'contacted' and
    v_draft_status not in (
      'drafted',
      'contacted'
    )
  then
    raise exception
      'draft must exist before contacted is recorded'
      using errcode = '22023';
  end if;

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
      'contacted must be recorded before replied'
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

  update lead_engine.outreach_drafts
  set
    status = case
      when p_activity_type = 'contacted'
        then 'contacted'
      when p_activity_type = 'replied'
        then 'replied'
      when p_activity_type = 'outcome' and
        p_outcome in (
          'won',
          'lost',
          'not_interested',
          'do_not_contact'
        )
        then 'closed'
      else status
    end,
    updated_at = now()
  where outreach_drafts.id =
    v_draft_id;

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
$record_outreach_activity$;

revoke all on function
lead_engine.record_outreach_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
)
from public, anon, authenticated;

grant execute on function
lead_engine.record_outreach_activity(
  uuid,
  uuid,
  text,
  text,
  text,
  timestamptz
)
to service_role;

comment on table
lead_engine.outlook_connections is
  'Encrypted delegated Outlook connection material. Backend service role only; the requested scope explicitly excludes Mail.Send.';

comment on table
lead_engine.outlook_oauth_states is
  'Short-lived, one-time PKCE state for founder-initiated Outlook connection. Backend service role only.';

comment on function
lead_engine.prepare_outlook_draft(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid[]
) is
  'Creates or reuses one evidence-linked initial Outlook draft record only after ready-queue, corporate-contact and suppression checks. It never sends email.';
