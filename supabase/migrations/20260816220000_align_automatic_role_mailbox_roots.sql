-- Keep database validation aligned with the application's approved role-based
-- business mailbox policy. The application accepts role mailbox variants such
-- as info.london@, sales-london@ and bookings+venue@ by validating the root
-- before + . _ or -. No schema shape changes.

create or replace function lead_engine.record_automatic_first_party_research(
  p_prospect_id uuid,
  p_actor_id uuid,
  p_attempt_count integer,
  p_facts jsonb
)
returns table (evidence_ids uuid[])
language plpgsql
security invoker
set search_path = ''
as $record_automatic_first_party_research$
declare
  v_fact jsonb;
  v_evidence_id uuid;
  v_evidence_ids uuid[] := '{}'::uuid[];
  v_field_name text;
  v_field_value text;
  v_source_url text;
  v_source_excerpt text;
  v_content_sha256 text;
  v_contact_type text;
  v_normalized_contact text;
  v_job_actor_id uuid;
  v_job_status text;
  v_job_attempt_count integer;
begin
  select actor_id, status, attempt_count
  into v_job_actor_id, v_job_status, v_job_attempt_count
  from lead_engine.company_enrichment
  where prospect_id = p_prospect_id
    and qualification_version = 'stage_4_2_v1'
  for update;

  if not found or
    v_job_actor_id is distinct from p_actor_id or
    v_job_status <> 'processing' or
    v_job_attempt_count <> p_attempt_count
  then
    raise exception
      'stale automatic qualification claim'
      using errcode = '40001';
  end if;

  if jsonb_typeof(p_facts) <> 'array' or
    jsonb_array_length(p_facts) > 30
  then
    raise exception
      'automatic research facts must be an array of at most 30 items'
      using errcode = '22023';
  end if;

  for v_fact in
    select value from jsonb_array_elements(p_facts)
  loop
    v_field_name := v_fact ->> 'field_name';
    v_field_value := nullif(btrim(v_fact ->> 'field_value'), '');
    v_source_url := v_fact ->> 'source_url';
    v_source_excerpt := nullif(btrim(v_fact ->> 'source_excerpt'), '');
    v_content_sha256 := v_fact ->> 'content_sha256';
    v_contact_type := nullif(v_fact ->> 'contact_type', '');
    v_normalized_contact :=
      nullif(lower(btrim(v_fact ->> 'normalized_contact_value')), '');

    if v_field_name not in (
      'business_name',
      'approved_sector',
      'business_status',
      'public_email',
      'public_phone',
      'contact_form_url',
      'recurring_cleaning_need',
      'premises_scale',
      'subscriber_type',
      'organisation_type',
      'website_url'
    ) or
      v_field_value is null or
      v_source_url !~* '^https://' or
      v_source_excerpt is null or
      length(v_source_excerpt) > 700 or
      v_content_sha256 !~ '^[0-9a-f]{64}$'
    then
      raise exception
        'invalid automatic first-party fact'
        using errcode = '22023';
    end if;

    if v_field_name = 'approved_sector' and
      v_field_value not in (
        'short_let_serviced_accommodation',
        'offices_coworking',
        'community_halls_event_venues',
        'estate_letting_agents',
        'university_accommodation',
        'other_commercial_spaces'
      )
    then
      raise exception 'invalid automatic sector fact'
        using errcode = '22023';
    end if;

    if v_field_name = 'approved_sector' and
      v_field_value is distinct from (
        select sector
        from lead_engine.prospects
        where id = p_prospect_id
      )
    then
      raise exception
        'automatic sector fact does not match the searched sector'
        using errcode = '22023';
    end if;

    if v_field_name = 'premises_scale' and
      v_field_value <> 'multiple_properties_locations_or_units'
    then
      raise exception 'invalid automatic scale fact'
        using errcode = '22023';
    end if;

    if v_field_name = 'organisation_type' and
      v_field_value not in (
        'commercial',
        'university',
        'public_body',
        'charity',
        'community_organisation',
        'unknown'
      )
    then
      raise exception 'invalid automatic organisation fact'
        using errcode = '22023';
    end if;

    if (
      v_field_name = 'business_status' and
      v_field_value <> 'active'
    ) or (
      v_field_name = 'subscriber_type' and
      v_field_value <> 'corporate'
    ) or (
      v_field_name in ('business_status', 'subscriber_type') and
      v_source_url !~* '^https://([^/]+\.)?(gov\.uk|ac\.uk)/'
    )
    then
      raise exception
        'automatic status and subscriber facts require an official institutional domain'
        using errcode = '22023';
    end if;

    if v_field_name = 'public_email' then
      if v_contact_type <> 'email' or
        v_normalized_contact is null or
        lower(v_field_value) <> v_normalized_contact or
        v_normalized_contact !~
          '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
        regexp_replace(
          split_part(v_normalized_contact, '@', 1),
          '[+._-].*$',
          ''
        ) not in (
          'accommodation', 'admin', 'bookings', 'business',
          'commercial', 'contact', 'enquiries', 'enquiry',
          'events', 'facilities', 'functions', 'hello', 'hire',
          'housing', 'info', 'lettings', 'management', 'office',
          'operations', 'property', 'reception', 'reservations',
          'residences', 'sales', 'spa', 'student', 'students',
          'support', 'team', 'venue'
        ) or
        split_part(v_normalized_contact, '@', 2) in (
          'gmail.com', 'googlemail.com', 'hotmail.com',
          'icloud.com', 'live.co.uk', 'live.com',
          'outlook.com', 'yahoo.co.uk', 'yahoo.com'
        )
      then
        raise exception 'automatic email is not a generic business mailbox'
          using errcode = '22023';
      end if;
    elsif v_field_name = 'public_phone' then
      if v_contact_type <> 'phone' or
        v_normalized_contact !~ '^0[0-9]{9,10}$'
      then
        raise exception 'invalid automatic public phone'
          using errcode = '22023';
      end if;
    elsif v_field_name = 'contact_form_url' then
      if v_contact_type <> 'contact_form' or
        v_normalized_contact !~* '^https://' or
        lower(v_field_value) <> v_normalized_contact
      then
        raise exception 'invalid automatic contact form'
          using errcode = '22023';
      end if;
    elsif v_contact_type is not null or
      v_normalized_contact is not null
    then
      raise exception 'contact metadata is not allowed for this fact'
        using errcode = '22023';
    end if;

    if v_field_name in (
      'website_url',
      'contact_form_url'
    ) and v_field_value !~* '^https://'
    then
      raise exception 'automatic URL fact must use HTTPS'
        using errcode = '22023';
    end if;

    insert into lead_engine.evidence (
      prospect_id,
      source_url,
      source_type,
      field_name,
      field_value,
      source_excerpt,
      content_sha256,
      verification_status,
      verified_at,
      verified_by,
      reviewed_at,
      reviewed_by,
      verification_method
    ) values (
      p_prospect_id,
      v_source_url,
      'first_party_website',
      v_field_name,
      v_field_value,
      v_source_excerpt,
      v_content_sha256,
      'verified',
      now(),
      p_actor_id,
      now(),
      p_actor_id,
      'automatic_first_party_research'
    )
    on conflict (prospect_id, content_sha256)
    where content_sha256 is not null
    do update set
      source_url = excluded.source_url,
      source_type = excluded.source_type,
      field_name = excluded.field_name,
      field_value = excluded.field_value,
      source_excerpt = excluded.source_excerpt,
      verification_status = 'verified',
      verified_at = now(),
      verified_by = p_actor_id,
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      review_note = null,
      verification_method = 'automatic_first_party_research'
    returning id into v_evidence_id;

    v_evidence_ids := array_append(
      v_evidence_ids,
      v_evidence_id
    );

    if v_contact_type is not null then
      insert into lead_engine.contacts (
        prospect_id,
        contact_type,
        contact_value,
        normalized_value,
        source_evidence_id,
        verification_status
      ) values (
        p_prospect_id,
        v_contact_type,
        v_field_value,
        v_normalized_contact,
        v_evidence_id,
        'verified'
      )
      on conflict (
        prospect_id,
        contact_type,
        normalized_value
      ) do update set
        contact_value = excluded.contact_value,
        source_evidence_id = excluded.source_evidence_id,
        verification_status = 'verified';
    end if;
  end loop;

  return query select v_evidence_ids;
end
$record_automatic_first_party_research$;

revoke all on function lead_engine.record_automatic_first_party_research(
  uuid, uuid, integer, jsonb
) from public, anon, authenticated;

grant execute on function lead_engine.record_automatic_first_party_research(
  uuid, uuid, integer, jsonb
) to service_role;

comment on function lead_engine.record_automatic_first_party_research(
  uuid, uuid, integer, jsonb
) is
  'Records bounded verified first-party facts using the approved role-based business mailbox root policy for an active Stage 4.2 worker claim.';
