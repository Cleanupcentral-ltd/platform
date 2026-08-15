-- One-off backfill for prospects researched before Contact Recovery went live.
-- Reuses the existing founder-priority retry path and does not affect Ready,
-- Excluded, or prospects that already have a verified contact route.

do $$
declare
  candidate record;
begin
  for candidate in
    select
      ce.prospect_id,
      ce.actor_id
    from lead_engine.company_enrichment ce
    join lead_engine.prospects p
      on p.id = ce.prospect_id
    where ce.qualification_version = 'stage_4_2_v1'
      and ce.qualification_state = 'needs_founder_decision'
      and ce.actor_id is not null
      and p.website_url is not null
      and ce.research_completed_at is not null
      and ce.research_completed_at < timestamptz '2026-08-15 01:08:20+00'
      and not exists (
        select 1
        from lead_engine.contacts c
        where c.prospect_id = ce.prospect_id
          and c.verification_status = 'verified'
          and c.contact_type in (
            'email',
            'phone',
            'contact_form'
          )
      )
  loop
    perform lead_engine.retry_company_enrichment(
      candidate.prospect_id,
      candidate.actor_id
    );
  end loop;
end
$$;
