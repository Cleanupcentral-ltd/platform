alter table lead_engine.company_enrichment
  drop constraint if exists company_enrichment_check;

alter table lead_engine.company_enrichment
  add constraint company_enrichment_check
  check (
    status <> 'auto_verified'
    or (
      discovered_company_number is not null
      and source_url is not null
      and source_content_sha256 is not null
    )
    or (
      discovered_company_number is null
      and coalesce(research_summary ->> 'organisationType', '') = 'charity'
      and coalesce(
        jsonb_typeof(research_summary -> 'charityNumbers') = 'array',
        false
      )
      and coalesce(
        jsonb_array_length(research_summary -> 'charityNumbers'),
        0
      ) = 1
      and coalesce(
        research_summary -> 'charityNumbers' ->> 0,
        ''
      ) ~ '^[0-9]{6,7}$'
    )
  );
