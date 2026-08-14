-- Stage 5 compliance correction: Google Places is discovery-only.
-- Persist only the Google Place ID. Durable business identity/contact data must
-- come from first-party or appropriate official verification sources.

create or replace function lead_engine.capture_lead_results(
  p_search_run_id uuid,
  p_sector text,
  p_results jsonb
)
returns table(
  result_count integer,
  created_count integer,
  created_prospect_ids uuid[]
)
language plpgsql
set search_path to ''
as $function$
declare
  result_item jsonb;
  evidence_item jsonb;
  v_prospect_id uuid;
  v_evidence_id uuid;
  inserted_rows integer;
  total_results integer;
  total_created integer := 0;
  v_created_prospect_ids uuid[] := '{}'::uuid[];
  v_is_google boolean;
  v_google_place_id text;
  v_google_maps_url text;
  v_google_content_sha256 text;
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
    v_is_google :=
      coalesce(result_item ->> 'dedupe_key', '')
        like 'google_places:%';
    v_google_place_id := null;
    v_google_maps_url := null;
    v_google_content_sha256 := null;

    if v_is_google then
      v_google_place_id := nullif(
        btrim(
          substring(
            result_item ->> 'dedupe_key'
            from char_length('google_places:') + 1
          )
        ),
        ''
      );

      if
        v_google_place_id is null or
        length(v_google_place_id) > 255
      then
        raise exception
          'Google Places result is missing a valid place ID'
          using errcode = '22023';
      end if;

      v_google_maps_url :=
        'https://www.google.com/maps/search/?api=1&query=Google+Place&query_place_id=' ||
        v_google_place_id;
      v_google_content_sha256 := encode(
        extensions.digest(
          v_google_maps_url || E'\ngoogle_place_id\n' || v_google_place_id,
          'sha256'
        ),
        'hex'
      );
    end if;

    insert into lead_engine.prospects (
      dedupe_key,
      business_name,
      sector,
      website_url,
      primary_postcode
    )
    values (
      result_item ->> 'dedupe_key',
      case
        when v_is_google then 'Pending verification'
        else result_item ->> 'business_name'
      end,
      p_sector,
      case
        when v_is_google then null
        else nullif(result_item ->> 'website_url', '')
      end,
      case
        when v_is_google then null
        else nullif(result_item ->> 'primary_postcode', '')
      end
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
      where dedupe_key = result_item ->> 'dedupe_key';

      if v_is_google then
        -- Never refresh durable prospect fields from Google Places content.
        update lead_engine.prospects
        set updated_at = now()
        where id = v_prospect_id;
      else
        update lead_engine.prospects
        set
          business_name = result_item ->> 'business_name',
          website_url = coalesce(
            nullif(result_item ->> 'website_url', ''),
            website_url
          ),
          primary_postcode = coalesce(
            nullif(result_item ->> 'primary_postcode', ''),
            primary_postcode
          ),
          updated_at = now()
        where id = v_prospect_id;
      end if;
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
        case
          when v_is_google then null
          else (result_item ->> 'source_rank')::integer
        end
      )
      on conflict (
        search_run_id,
        prospect_id
      ) do update
      set source_rank = case
        when v_is_google then null
        else least(
          lead_engine.search_run_prospects.source_rank,
          excluded.source_rank
        )
      end;
    end if;

    if v_is_google then
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
        v_google_maps_url,
        'google_places',
        'google_place_id',
        v_google_place_id,
        'Google Places identifier.',
        v_google_content_sha256
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
        source_excerpt = excluded.source_excerpt;
    else
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
          nullif(evidence_item ->> 'source_excerpt', ''),
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
          nullif(evidence_item ->> 'contact_type', '') is not null
          and nullif(
            evidence_item ->> 'normalized_contact_value',
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
            evidence_item ->> 'normalized_contact_value',
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
    end if;
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
$function$;

-- Remove contacts whose only provenance is stored Google Places content.
delete from lead_engine.contacts as contact
using lead_engine.evidence as evidence
where
  contact.source_evidence_id = evidence.id
  and evidence.source_type = 'google_places'
  and evidence.field_name <> 'google_place_id';

-- Remove all stored Google Places content except the permitted Place ID.
delete from lead_engine.evidence
where
  source_type = 'google_places'
  and field_name <> 'google_place_id';

-- Normalize the retained Place-ID evidence so it contains no copied Google
-- business content in its URL/excerpt/hash material.
update lead_engine.evidence
set
  source_url =
    'https://www.google.com/maps/search/?api=1&query=Google+Place&query_place_id=' ||
    field_value,
  source_excerpt = 'Google Places identifier.',
  content_sha256 = encode(
    extensions.digest(
      'https://www.google.com/maps/search/?api=1&query=Google+Place&query_place_id=' ||
      field_value || E'\ngoogle_place_id\n' || field_value,
      'sha256'
    ),
    'hex'
  )
where
  source_type = 'google_places'
  and field_name = 'google_place_id';

-- Google search rank is not required for durable lead operation.
update lead_engine.search_run_prospects as search_result
set source_rank = null
where exists (
  select 1
  from lead_engine.prospects as prospect
  where
    prospect.id = search_result.prospect_id
    and prospect.dedupe_key like 'google_places:%'
);

-- Rebuild durable prospect identity only from independently verified sources.
with durable_identity as (
  select
    prospect.id,
    coalesce(
      (
        select evidence.field_value
        from lead_engine.evidence as evidence
        where
          evidence.prospect_id = prospect.id
          and evidence.source_type = 'first_party_website'
          and evidence.field_name = 'business_name'
          and evidence.verification_status = 'verified'
        order by
          evidence.verified_at desc nulls last,
          evidence.captured_at desc,
          evidence.id desc
        limit 1
      ),
      (
        select evidence.field_value
        from lead_engine.evidence as evidence
        where
          evidence.prospect_id = prospect.id
          and evidence.source_type = 'companies_house'
          and evidence.field_name = 'business_name'
          and evidence.verification_status = 'verified'
        order by
          evidence.verified_at desc nulls last,
          evidence.captured_at desc,
          evidence.id desc
        limit 1
      )
    ) as business_name,
    (
      select evidence.field_value
      from lead_engine.evidence as evidence
      where
        evidence.prospect_id = prospect.id
        and evidence.source_type = 'first_party_website'
        and evidence.field_name = 'website_url'
        and evidence.verification_status = 'verified'
      order by
        evidence.verified_at desc nulls last,
        evidence.captured_at desc,
        evidence.id desc
      limit 1
    ) as website_url
  from lead_engine.prospects as prospect
  where prospect.dedupe_key like 'google_places:%'
)
update lead_engine.prospects as prospect
set
  business_name = coalesce(
    durable_identity.business_name,
    'Pending verification'
  ),
  website_url = durable_identity.website_url,
  primary_postcode = null,
  updated_at = now()
from durable_identity
where prospect.id = durable_identity.id;

-- Defense in depth: future Google evidence rows can contain only a Place ID.
alter table lead_engine.evidence
  drop constraint if exists evidence_google_places_place_id_only;

alter table lead_engine.evidence
  add constraint evidence_google_places_place_id_only
  check (
    source_type <> 'google_places'
    or field_name = 'google_place_id'
  );
