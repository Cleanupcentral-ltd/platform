-- Re-run existing Stage 4.2 prospects through the current automatic research
-- engine so the new verified first-party phone rule applies consistently to
-- the existing database. Excluded prospects remain untouched.

update lead_engine.company_enrichment as enrichment
set
  status = 'pending',
  qualification_state = 'processing',
  qualification_reasons =
    '["public_contact_revalidation_required"]'::jsonb,
  attempt_count = 0,
  available_at = now(),
  founder_priority_requested_at = null,
  lease_expires_at = null,
  completed_at = null,
  research_completed_at = null,
  last_error_code = null,
  updated_at = now()
where
  enrichment.qualification_version =
    'stage_4_2_v1' and
  enrichment.qualification_state <> 'excluded' and
  not exists (
    select 1
    from lead_engine.evidence as evidence
    where
      evidence.prospect_id = enrichment.prospect_id and
      evidence.source_type = 'first_party_website' and
      evidence.field_name = 'public_phone' and
      evidence.verification_status = 'verified'
  );
