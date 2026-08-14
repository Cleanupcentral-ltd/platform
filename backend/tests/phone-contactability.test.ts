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
const PHONE_EVIDENCE_ID =
  "22222222-2222-4222-8222-222222222222";
const SUBSCRIBER_EVIDENCE_ID =
  "33333333-3333-4333-8333-333333333333";

function evidence(
  id: string,
  fieldName: string,
  fieldValue: string,
): LeadEvidenceRecord {
  return {
    id,
    sourceUrl: "https://example.com/contact",
    sourceType: "first_party_website",
    fieldName,
    fieldValue,
    sourceExcerpt: "Verified first-party evidence.",
    verificationStatus: "verified",
    capturedAt: "2026-08-14T12:00:00.000Z",
    verifiedAt: "2026-08-14T12:00:00.000Z",
    verificationMethod:
      "automatic_first_party_research",
  };
}

function phoneOnlyProspect(): LeadProspectReview {
  return {
    id: PROSPECT_ID,
    businessName: "Example Business",
    sector: "offices_coworking",
    primaryPostcode: "BR1 1AA",
    websiteUrl: "https://example.com/",
    companyNumber: null,
    createdAt: "2026-08-14T10:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: [
      evidence(
        PHONE_EVIDENCE_ID,
        "public_phone",
        "020 8464 5566",
      ),
      evidence(
        SUBSCRIBER_EVIDENCE_ID,
        "subscriber_type",
        "corporate",
      ),
    ],
    contacts: [{
      id:
        "44444444-4444-4444-8444-444444444444",
      contactType: "phone",
      contactValue: "020 8464 5566",
      normalizedValue: "02084645566",
      sourceEvidenceId: PHONE_EVIDENCE_ID,
      verificationStatus: "verified",
    }],
    latestAssessment: null,
  };
}

test(
  "a verified first-party phone is a usable contact route but does not fake email readiness",
  () => {
    const result = calculateLeadAssessment(
      phoneOnlyProspect(),
    );

    assert.equal(
      result.scoreBreakdown
        .compliantContactability.points,
      1,
    );
    assert.equal(
      result.blockers.includes(
        "no_verified_contact_route",
      ),
      false,
    );
    assert.equal(
      result.blockers.includes(
        "unapproved_email_basis",
      ),
      true,
    );
  },
);
