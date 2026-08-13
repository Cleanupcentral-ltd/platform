import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLeadAssessment,
  LEAD_SCORING_VERSION,
} from "../src/domain/lead-assessment.js";

import type {
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";

function evidence(
  id: string,
  sourceType: string,
  fieldName: string,
  fieldValue: string,
): LeadEvidenceRecord {
  return {
    id,
    sourceUrl:
      sourceType === "companies_house"
        ? "https://find-and-update.company-information.service.gov.uk/company/12345678"
        : `https://example.com/${id}`,
    sourceType,
    fieldName,
    fieldValue,
    sourceExcerpt: null,
    verificationStatus: "verified",
    capturedAt:
      "2026-08-11T12:00:00.000Z",
    verifiedAt:
      "2026-08-11T12:00:00.000Z",
  };
}

function prospect(
  overrides:
    Partial<LeadProspectReview> = {},
): LeadProspectReview {
  return {
    id: PROSPECT_ID,
    businessName: "Example Offices",
    sector: "offices_coworking",
    primaryPostcode: "BR1 1AA",
    websiteUrl:
      "https://example.com/",
    companyNumber: null,
    createdAt:
      "2026-08-11T10:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: [],
    contacts: [],
    latestAssessment: null,
    ...overrides,
  };
}

test(
  "unverified discovery data scores transparently but remains research required",
  () => {
    const result =
      calculateLeadAssessment(
        prospect(),
      );

    assert.equal(
      result.rulesVersion,
      LEAD_SCORING_VERSION,
    );
    assert.equal(result.totalScore, 2);
    assert.equal(
      result.scoreBreakdown
        .sectorServiceFit.points,
      1,
    );
    assert.equal(
      result.scoreBreakdown
        .recurringCleaningNeed.points,
      1,
    );
    assert.equal(
      result.eligibilityResult,
      "research_required",
    );
    assert.ok(
      result.blockers.includes(
        "missing_verified_identity",
      ),
    );
    assert.equal(
      result.rationale.includes(
        "does not override",
      ),
      true,
    );
  },
);

test(
  "verified corporate first-party contact can become ready while the founder remains the draft approval gate",
  () => {
    const records = [
      evidence(
        "10000000-0000-4000-8000-000000000001",
        "first_party_website",
        "business_name",
        "Example Offices",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000002",
        "first_party_website",
        "approved_sector",
        "offices_coworking",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000003",
        "first_party_website",
        "business_status",
        "active",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000004",
        "first_party_website",
        "recurring_cleaning_need",
        "Coworking offices operate daily.",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000005",
        "first_party_website",
        "premises_scale",
        "multiple_properties_locations_or_units",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000006",
        "first_party_website",
        "public_email",
        "hello@example.com",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000007",
        "companies_house",
        "subscriber_type",
        "corporate",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000009",
        "companies_house",
        "company_number",
        "12345678",
      ),
    ];
    const result =
      calculateLeadAssessment(
        prospect({
          evidence: records,
          contacts: [{
            id:
              "20000000-0000-4000-8000-000000000001",
            contactType: "email",
            contactValue:
              "hello@example.com",
            normalizedValue:
              "hello@example.com",
            sourceEvidenceId:
              records[5]!.id,
            verificationStatus:
              "verified",
          }],
        }),
      );

    assert.equal(result.totalScore, 10);
    assert.equal(
      result.eligibilityResult,
      "eligible",
    );
    assert.deepEqual(result.blockers, []);
    assert.equal(
      result.scoreBreakdown
        .compliantContactability
        .points,
      2,
    );
    assert.equal(
      result.scoreBreakdown
        .evidenceConfidence.points,
      2,
    );
    assert.ok(
      result.evidenceIds.includes(
        records[0]!.id,
      ),
    );
  },
);

test(
  "a suppression hard-blocks eligibility without changing the evidence score",
  () => {
    const base = prospect({
      hasActiveSuppression: true,
    });
    const result =
      calculateLeadAssessment(base);

    assert.equal(result.totalScore, 2);
    assert.equal(
      result.eligibilityResult,
      "research_required",
    );
    assert.ok(
      result.blockers.includes(
        "do_not_contact_or_objection",
      ),
    );
  },
);

test(
  "a provider contact cannot be upgraded into compliant contactability without persistent source evidence",
  () => {
    const providerEmail = evidence(
      "10000000-0000-4000-8000-000000000010",
      "google_places",
      "public_email",
      "hello@example.com",
    );
    const result =
      calculateLeadAssessment(
        prospect({
          evidence: [providerEmail],
          contacts: [{
            id:
              "20000000-0000-4000-8000-000000000010",
            contactType: "email",
            contactValue:
              "hello@example.com",
            normalizedValue:
              "hello@example.com",
            sourceEvidenceId:
              providerEmail.id,
            verificationStatus:
              "verified",
          }],
        }),
      );

    assert.equal(
      result.scoreBreakdown
        .compliantContactability
        .points,
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
  "a personal mailbox stays in founder review even with corporate evidence",
  () => {
    const emailEvidence = evidence(
      "10000000-0000-4000-8000-000000000011",
      "first_party_website",
      "public_email",
      "amirah@example.com",
    );
    const subscriberEvidence = evidence(
      "10000000-0000-4000-8000-000000000012",
      "companies_house",
      "subscriber_type",
      "corporate",
    );
    const result = calculateLeadAssessment(
      prospect({
        evidence: [
          emailEvidence,
          subscriberEvidence,
        ],
        contacts: [{
          id:
            "20000000-0000-4000-8000-000000000011",
          contactType: "email",
          contactValue:
            "amirah@example.com",
          normalizedValue:
            "amirah@example.com",
          sourceEvidenceId:
            emailEvidence.id,
          verificationStatus:
            "verified",
        }],
      }),
    );

    assert.equal(
      result.scoreBreakdown
        .compliantContactability.points,
      0,
    );
    assert.ok(
      result.blockers.includes(
        "unapproved_email_basis",
      ),
    );
  },
);

test(
  "score_below_ready_threshold regression: otherwise clear 6-point prospect remains research required",
  () => {
    const sameSource = "https://example.com/";
    const records = [
      evidence(
        "10000000-0000-4000-8000-000000000021",
        "first_party_website",
        "business_name",
        "Example Offices",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000022",
        "first_party_website",
        "approved_sector",
        "offices_coworking",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000023",
        "first_party_website",
        "business_status",
        "active",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000024",
        "first_party_website",
        "public_email",
        "hello@example.com",
      ),
      evidence(
        "10000000-0000-4000-8000-000000000025",
        "first_party_website",
        "subscriber_type",
        "corporate",
      ),
    ].map((item) => ({
      ...item,
      sourceUrl: sameSource,
    }));

    const result = calculateLeadAssessment(
      prospect({
        evidence: records,
        contacts: [{
          id:
            "20000000-0000-4000-8000-000000000021",
          contactType: "email",
          contactValue: "hello@example.com",
          normalizedValue: "hello@example.com",
          sourceEvidenceId: records[3]!.id,
          verificationStatus: "verified",
        }],
      }),
    );

    assert.equal(result.totalScore, 6);
    assert.equal(
      result.eligibilityResult,
      "research_required",
    );
    assert.deepEqual(
      result.blockers,
      ["score_below_ready_threshold"],
    );
  },
);
