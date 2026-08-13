create or replace function lead_engine.record_automatic_single_premises(
  p_prospect_id uuid,
  p_actor_id uuid,
  p_attempt_count integer,
  p_source_url text,
  p_source_excerpt text,
  p_content_sha256 text
)
returns table (evidence_ids uuid[])
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_actor_id uuid;
  v_status text;
  v_attempt_count integer;
  v_postcode text;
  v_evidence_id uuid;
begin
  select actor_id, status, attempt_count
  into v_actor_id, v_status, v_attempt_count
  from lead_engine.company_enrichment
  where prospect_id = p_prospect_id
    and qualification_version = 'stage_4_2_v1'
  for update;

  if not found or
    v_actor_id is distinct from p_actor_id or
    v_status <> 'processing' or
    v_attempt_count <> p_attempt_count
  then
    raise exception 'stale automatic qualification claim'
      using errcode = '40001';
  end if;

  select upper(regexp_replace(coalesce(primary_postcode, ''), '\s+', '', 'g'))
  into v_postcode
  from lead_engine.prospects
  where id = p_prospect_id;

  if v_postcode = '' or
    p_source_url !~* '^https://' or
    nullif(btrim(p_source_excerpt), '') is null or
    length(p_source_excerpt) > 700 or
    p_content_sha256 !~ '^[0-9a-f]{64}$' or
    position(v_postcode in upper(regexp_replace(p_source_excerpt, '\s+', '', 'g'))) = 0
  then
    raise exception 'single premises evidence failed postcode cross-check'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from lead_engine.evidence
    where prospect_id = p_prospect_id
      and source_type = 'first_party_website'
      and field_name = 'business_name'
      and source_url = p_source_url
      and verification_status = 'verified'
  ) then
    raise exception 'single premises evidence requires verified first-party identity'
      using errcode = '22023';
  end if;

  insert into lead_engine.evidence (
    prospect_id, source_url, source_type, field_name, field_value,
    source_excerpt, content_sha256, verification_status,
    verified_at, verified_by, reviewed_at, reviewed_by,
    verification_method
  ) values (
    p_prospect_id, p_source_url, 'first_party_website',
    'premises_scale', 'one_active_premises',
    p_source_excerpt, p_content_sha256, 'verified',
    now(), p_actor_id, now(), p_actor_id,
    'automatic_first_party_research'
  )
  on conflict (prospect_id, content_sha256)
  where content_sha256 is not null
  do update set
    source_url = excluded.source_url,
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

  return query select array[v_evidence_id]::uuid[];
end
$fn$;

revoke all on function lead_engine.record_automatic_single_premises(uuid, uuid, integer, text, text, text)
from public, anon, authenticated;

grant execute on function lead_engine.record_automatic_single_premises(uuid, uuid, integer, text, text, text)
to service_role;
