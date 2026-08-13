import assert from "node:assert/strict";
import test from "node:test";

import {
  createLeadReviewService,
  LeadReviewError,
} from "../src/application/review-leads.js";

import type {
  AddVerifiedLeadEvidenceInput,
  LeadProspectReview,
  LeadReviewRepository,
  SaveLeadAssessmentInput,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

const review: LeadProspectReview = {
  id: PROSPECT_ID,
  businessName: "Example Business",
  sector: "offices_coworking",
  primaryPostcode: "BR1 1AA",
  websiteUrl: null,
  companyNumber: null,
  createdAt:
    "2026-08-11T10:00:00.000Z",
  hasSearchProvenance: true,
  hasActiveSuppression: false,
  evidence: [],
  contacts: [],
  latestAssessment: null,
};

function repository(
  captures: {
    evidence?:
      AddVerifiedLeadEvidenceInput;
    assessment?:
      SaveLeadAssessmentInput;
  },
): LeadReviewRepository {
  return {
    async listProspects() {
      return [];
    },
    async getProspect() {
      return review;
    },
    async addVerifiedEvidence(input) {
      captures.evidence = input;
      return "33333333-3333-4333-8333-333333333333";
    },
    async findProspectByCompanyNumber() {
      return null;
    },
    async recordCompaniesHouseVerification() {
      return [];
    },
    async recordAutomaticCompaniesHouseVerification() {
      return [];
    },
    async decideEvidence() {},
    async saveAssessment(input) {
      captures.assessment = input;
      return {
        id:
          "44444444-4444-4444-8444-444444444444",
        totalScore: input.totalScore,
        rulesVersion:
          input.rulesVersion,
        eligibilityResult:
          input.eligibilityResult,
        scoreBreakdown:
          input.scoreBreakdown,
        blockers: input.blockers,
        rationale: input.rationale,
        evidenceIds:
          input.evidenceIds,
        assessedAt:
          "2026-08-11T12:00:00.000Z",
      };
    },
  };
}

test(
  "verified public email is normalized, fingerprinted and linked to its source",
  async () => {
    const captures: {
      evidence?:
        AddVerifiedLeadEvidenceInput;
      assessment?:
        SaveLeadAssessmentInput;
    } = {};
    const service =
      createLeadReviewService(
        repository(captures),
      );

    const result = await service.addEvidence(
      FOUNDER_ID,
      PROSPECT_ID,
      {
        sourceType:
          "first_party_website",
        sourceUrl:
          "https://example.com/contact#email",
        factName: "public_email",
        factValue:
          " HELLO@EXAMPLE.COM ",
        sourceExcerpt: null,
      },
    );

    assert.equal(
      captures.evidence
        ?.sourceUrl,
      "https://example.com/contact",
    );
    assert.equal(
      captures.evidence
        ?.factValue,
      "hello@example.com",
    );
    assert.equal(
      captures.evidence
        ?.contactType,
      "email",
    );
    assert.match(
      captures.evidence
        ?.contentSha256 ?? "",
      /^[0-9a-f]{64}$/,
    );
    assert.equal(
      result.automaticAssessment.status,
      "updated",
    );
    assert.equal(
      captures.assessment?.prospectId,
      PROSPECT_ID,
    );
  },
);

test(
  "verified evidence stays saved when automatic recalculation is temporarily unavailable",
  async () => {
    const captures: {
      evidence?:
        AddVerifiedLeadEvidenceInput;
    } = {};
    const base = repository(captures);
    const service =
      createLeadReviewService({
        ...base,
        async saveAssessment() {
          throw new Error(
            "temporary scoring failure",
          );
        },
      });

    const result = await service.addEvidence(
      FOUNDER_ID,
      PROSPECT_ID,
      {
        sourceType:
          "first_party_website",
        sourceUrl:
          "https://example.com/about",
        factName: "business_name",
        factValue:
          "Example Business",
        sourceExcerpt: null,
      },
    );

    assert.ok(captures.evidence);
    assert.deepEqual(
      result.automaticAssessment,
      {
        status: "pending",
        assessment: null,
      },
    );
  },
);

test(
  "founder evidence decisions automatically create a new versioned assessment",
  async () => {
    const captures: {
      assessment?:
        SaveLeadAssessmentInput;
    } = {};
    const evidenceId =
      "33333333-3333-4333-8333-333333333333";
    const base = repository(captures);
    const service =
      createLeadReviewService({
        ...base,
        async getProspect() {
          return {
            ...review,
            evidence: [{
              id: evidenceId,
              sourceUrl:
                "https://example.com/about",
              sourceType:
                "first_party_website",
              fieldName:
                "business_name",
              fieldValue:
                "Example Business",
              sourceExcerpt: null,
              verificationStatus:
                "unverified",
              capturedAt:
                "2026-08-11T10:00:00.000Z",
              verifiedAt: null,
            }],
          };
        },
      });

    const result =
      await service.decideEvidence(
        FOUNDER_ID,
        PROSPECT_ID,
        evidenceId,
        {
          decision: "rejected",
          reviewNote: null,
        },
      );

    assert.equal(result.status, "updated");
    assert.equal(
      captures.assessment?.founderId,
      FOUNDER_ID,
    );
  },
);

test(
  "non-HTTPS evidence is rejected before persistence",
  async () => {
    const service =
      createLeadReviewService(
        repository({}),
      );

    await assert.rejects(
      service.addEvidence(
        FOUNDER_ID,
        PROSPECT_ID,
        {
          sourceType:
            "companies_house",
          sourceUrl:
            "http://example.com/company",
          factName:
            "company_number",
          factValue: "12345678",
          sourceExcerpt: null,
        },
      ),
      (error: unknown) =>
        error instanceof
          LeadReviewError &&
        error.failure ===
          "invalid_evidence",
    );
  },
);

test(
  "Companies House evidence is limited to official company facts and official URLs",
  async () => {
    const service =
      createLeadReviewService(
        repository({}),
      );

    await assert.rejects(
      service.addEvidence(
        FOUNDER_ID,
        PROSPECT_ID,
        {
          sourceType:
            "companies_house",
          sourceUrl:
            "https://find-and-update.company-information.service.gov.uk/company/12345678",
          factName: "public_email",
          factValue:
            "hello@example.com",
          sourceExcerpt: null,
        },
      ),
      (error: unknown) =>
        error instanceof
          LeadReviewError &&
        error.failure ===
          "invalid_evidence",
    );
  },
);

test(
  "Companies House evidence cannot assign a Clean Up Central pilot sector",
  async () => {
    const service =
      createLeadReviewService(
        repository({}),
      );

    await assert.rejects(
      service.addEvidence(
        FOUNDER_ID,
        PROSPECT_ID,
        {
          sourceType:
            "companies_house",
          sourceUrl:
            "https://find-and-update.company-information.service.gov.uk/company/12345678",
          factName:
            "approved_sector",
          factValue:
            "offices_coworking",
          sourceExcerpt: null,
        },
      ),
      (error: unknown) =>
        error instanceof
          LeadReviewError &&
        error.failure ===
          "invalid_evidence",
    );
  },
);

test(
  "assessment is calculated server-side and stored as a versioned snapshot",
  async () => {
    const captures: {
      assessment?:
        SaveLeadAssessmentInput;
    } = {};
    const service =
      createLeadReviewService(
        repository(captures),
      );

    const result = await service.assess(
      FOUNDER_ID,
      PROSPECT_ID,
    );

    assert.equal(result.totalScore, 2);
    assert.equal(
      captures.assessment
        ?.rulesVersion,
      "cuc-lel-0-10-v1.1",
    );
    assert.equal(
      captures.assessment
        ?.founderId,
      FOUNDER_ID,
    );
    assert.equal(
      captures.assessment
        ?.eligibilityResult,
      "research_required",
    );
  },
);
