-- Retire contact-form evidence created by the legacy broad <form> detector.
-- Keep rows for audit, reject linked contacts, and requeue every affected
-- automatic-qualification prospect through the stricter v2 detector.

with legacy_contact_forms as (
  select evidence.id
  from lead_engine.evidence as evidence
  where
    evidence.source_type = 'first_party_website' and
    evidence.field_name = 'contact_form_url' and
    evidence.verification_status = 'verified' and
    evidence.verification_method = 'automatic_first_party_research' and
    coalesce(evidence.source_excerpt, '') not like
      'Verified contact form v2:%'
)
update lead_engine.contacts as contact
set verification_status = 'rejected'
where contact.source_evidence_id in (
  select id from legacy_contact_forms
);

with legacy_contact_forms as (
  select evidence.id
  from lead_engine.evidence as evidence
  where
    evidence.source_type = 'first_party_website' and
    evidence.field_name = 'contact_form_url' and
    evidence.verification_status = 'verified' and
    evidence.verification_method = 'automatic_first_party_research' and
    coalesce(evidence.source_excerpt, '') not like
      'Verified contact form v2:%'
)
update lead_engine.evidence as evidence
set
  verification_status = 'rejected',
  verified_at = null,
  verified_by = null,
  reviewed_at = now(),
  review_note =
    'Superseded by stricter contact-form detector v2; retained for audit.'
where evidence.id in (
  select id from legacy_contact_forms
);

with affected_prospects as (
  select distinct evidence.prospect_id
  from lead_engine.evidence as evidence
  where
    evidence.source_type = 'first_party_website' and
    evidence.field_name = 'contact_form_url' and
    evidence.verification_method = 'automatic_first_party_research' and
    evidence.verification_status = 'rejected' and
    evidence.review_note =
      'Superseded by stricter contact-form detector v2; retained for audit.'
)
update lead_engine.company_enrichment as enrichment
set
  status = 'pending',
  qualification_state = 'processing',
  qualification_reasons =
    '["contact_form_revalidation_required"]'::jsonb,
  attempt_count = 0,
  available_at = now(),
  founder_priority_requested_at = null,
  lease_expires_at = null,
  completed_at = null,
  research_completed_at = null,
  last_error_code = null,
  updated_at = now()
from affected_prospects
where
  enrichment.prospect_id =
    affected_prospects.prospect_id and
  enrichment.qualification_version =
    'stage_4_2_v1' and
  enrichment.qualification_state <> 'excluded';
