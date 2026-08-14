import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLeadAssessment,
} from "../src/domain/lead-assessment.js";

import type {
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FORM_EVIDENCE_ID =
  "22222222-2222-4222-8222-222222222222";

function formEvidence(
  sourceExcerpt: string,
  verificationMethod:
    NonNullable<
      LeadEvidenceRecord["verificationMethod"]
    >,
): LeadEvidenceRecord {
  return {
    id: FORM_EVIDENCE_ID,
    sourceUrl:
      "https://example.com/contact",
    sourceType:
      "first_party_website",
    fieldName: "contact_form_url",
    fieldValue:
      "https://example.com/contact",
    sourceExcerpt,
    verificationStatus: "verified",
    capturedAt:
      "2026-08-14T12:00:00.000Z",
    verifiedAt:
      "2026-08-14T12:00:00.000Z",
    verificationMethod,
  };
}

function prospect(
  evidence: LeadEvidenceRecord,
): LeadProspectReview {
  return {
    id: PROSPECT_ID,
    businessName: "Example Hall",
    sector:
      "community_halls_event_venues",
    primaryPostcode: null,
    websiteUrl:
      "https://example.com/",
    companyNumber: null,
    createdAt:
      "2026-08-14T10:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: [evidence],
    contacts: [{
      id:
        "33333333-3333-4333-8333-333333333333",
      contactType: "contact_form",
      contactValue:
        "https://example.com/contact",
      normalizedValue:
        "https://example.com/contact",
      sourceEvidenceId:
        FORM_EVIDENCE_ID,
      verificationStatus: "verified",
    }],
    latestAssessment: null,
  };
}

test(
  "legacy automatic contact form evidence no longer earns contactability",
  () => {
    const result = calculateLeadAssessment(
      prospect(
        formEvidence(
          "A public contact form is present on this first-party page.",
          "automatic_first_party_research",
        ),
      ),
    );

    assert.equal(
      result.scoreBreakdown
        .compliantContactability.points,
      0,
    );
    assert.ok(
      result.blockers.includes(
        "no_verified_contact_route",
      ),
    );
  },
);

test(
  "strict v2 automatic contact form evidence earns contactability",
  () => {
    const result = calculateLeadAssessment(
      prospect(
        formEvidence(
          "Verified contact form v2: form contains name, email, message/enquiry fields.",
          "automatic_first_party_research",
        ),
      ),
    );

    assert.equal(
      result.scoreBreakdown
        .compliantContactability.points,
      1,
    );
  },
);

test(
  "founder-reviewed contact forms remain trusted",
  () => {
    const result = calculateLeadAssessment(
      prospect(
        formEvidence(
          "Founder verified public contact form.",
          "founder_review",
        ),
      ),
    );

    assert.equal(
      result.scoreBreakdown
        .compliantContactability.points,
      1,
    );
  },
);
