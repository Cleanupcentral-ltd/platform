import assert from "node:assert/strict";
import test from "node:test";

import {
  createManualOutreachService,
  OutreachError,
} from "../src/application/outreach.js";

import type {
  LeadEvidenceRecord,
  LeadProspectReview,
} from "../src/ports/lead-review.js";

import type {
  ManualOutreachRepository,
} from "../src/ports/manual-outreach.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";
const EMAIL_EVIDENCE_ID =
  "33333333-3333-4333-8333-333333333333";
const EMAIL_CONTACT_ID =
  "44444444-4444-4444-8444-444444444444";

function evidence(
  id: string,
  fieldName: string,
  fieldValue: string,
  sourceType = "first_party_website",
): LeadEvidenceRecord {
  return {
    id,
    sourceUrl:
      sourceType === "companies_house"
        ? "https://find-and-update.company-information.service.gov.uk/company/12345678"
        : "https://example.com/contact",
    sourceType,
    fieldName,
    fieldValue,
    sourceExcerpt: fieldValue,
    verificationStatus: "verified",
    capturedAt: "2026-08-17T00:00:00.000Z",
    verifiedAt: "2026-08-17T00:00:00.000Z",
  };
}

function readyProspect(
  corporateSubscriber: boolean,
): LeadProspectReview {
  const records: LeadEvidenceRecord[] = [
    evidence(
      "10000000-0000-4000-8000-000000000001",
      "business_name",
      "Example Offices",
    ),
    evidence(
      "10000000-0000-4000-8000-000000000002",
      "approved_sector",
      "offices_coworking",
    ),
    evidence(
      EMAIL_EVIDENCE_ID,
      "public_email",
      "info@example.com",
    ),
    evidence(
      "10000000-0000-4000-8000-000000000004",
      "public_phone",
      "020 8000 0000",
    ),
  ];
  if (corporateSubscriber) {
    records.push(
      evidence(
        "10000000-0000-4000-8000-000000000005",
        "subscriber_type",
        "corporate",
        "companies_house",
      ),
    );
  }

  return {
    id: PROSPECT_ID,
    businessName: "Example Offices",
    sector: "offices_coworking",
    primaryPostcode: "BR1 1AA",
    websiteUrl: "https://example.com/",
    companyNumber: null,
    createdAt: "2026-08-17T00:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: records,
    contacts: [
      {
        id: EMAIL_CONTACT_ID,
        contactType: "email",
        contactValue: "info@example.com",
        normalizedValue: "info@example.com",
        sourceEvidenceId: EMAIL_EVIDENCE_ID,
        verificationStatus: "verified",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        contactType: "phone",
        contactValue: "020 8000 0000",
        normalizedValue: "02080000000",
        sourceEvidenceId:
          "10000000-0000-4000-8000-000000000004",
        verificationStatus: "verified",
      },
    ],
    latestAssessment: {
      id: "66666666-6666-4666-8666-666666666666",
      totalScore: 5,
      rulesVersion: "cuc-lel-0-10-v1.6",
      eligibilityResult: "eligible",
      scoreBreakdown: {},
      blockers: [],
      rationale: "Ready by verified phone route.",
      evidenceIds: records.map((item) => item.id),
      assessedAt: "2026-08-17T00:01:00.000Z",
    },
    companyEnrichment: {
      status: "review_required",
      discoveredCompanyNumber: null,
      sourceUrl: null,
      candidates: [],
      lastErrorCode: null,
      attemptCount: 1,
      lastAttemptAt: "2026-08-17T00:00:30.000Z",
      completedAt: "2026-08-17T00:01:00.000Z",
      qualificationState: "ready_for_outreach",
    },
  };
}

function repository(): ManualOutreachRepository {
  return {
    async listActivities() {
      return [];
    },
    async recordManualActivity() {
      throw new Error("not used");
    },
  };
}

function service(corporateSubscriber: boolean) {
  return createManualOutreachService({
    leadReviewService: {
      async getProspect() {
        return readyProspect(corporateSubscriber);
      },
    },
    repository: repository(),
    privacyUrl: "https://www.cleanupcentral.com/#/privacy",
    optOutText: "Reply to opt out.",
  });
}

test(
  "ready by phone does not unlock email drafting without verified corporate subscriber basis",
  async () => {
    await assert.rejects(
      service(false).previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        EMAIL_CONTACT_ID,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure === "unsupported_contact",
    );
  },
);

test(
  "verified corporate subscriber basis unlocks the same generic business email",
  async () => {
    const preview = await service(true)
      .previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        EMAIL_CONTACT_ID,
      );

    assert.equal(
      preview.recipientEmail,
      "info@example.com",
    );
  },
);
