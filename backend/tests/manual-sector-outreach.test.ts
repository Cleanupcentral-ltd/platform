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
  OutreachRepository,
} from "../src/ports/outreach.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";
const CONTACT_ID =
  "33333333-3333-4333-8333-333333333333";

function evidence(
  index: number,
  fieldName: string,
  fieldValue: string,
): LeadEvidenceRecord {
  return {
    id:
      `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    sourceUrl:
      `https://example.com/source-${index}`,
    sourceType:
      "first_party_website",
    fieldName,
    fieldValue,
    sourceExcerpt: fieldValue,
    verificationStatus: "verified",
    capturedAt:
      "2026-08-14T12:00:00.000Z",
    verifiedAt:
      "2026-08-14T12:00:00.000Z",
  };
}

function prospect(
  sector: LeadProspectReview["sector"],
  verifiedSector = sector,
): LeadProspectReview {
  const records = [
    evidence(1, "business_name", "Example Business"),
    evidence(2, "approved_sector", verifiedSector),
    evidence(3, "business_status", "active"),
    evidence(4, "subscriber_type", "corporate"),
    evidence(5, "public_email", "info@example.com"),
  ];
  return {
    id: PROSPECT_ID,
    businessName: "Example Business",
    sector,
    primaryPostcode: "BR1 1AA",
    websiteUrl: "https://example.com/",
    companyNumber: "12345678",
    createdAt:
      "2026-08-14T11:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: records,
    contacts: [{
      id: CONTACT_ID,
      contactType: "email",
      contactValue: "info@example.com",
      normalizedValue: "info@example.com",
      sourceEvidenceId: records[4]!.id,
      verificationStatus: "verified",
    }],
    latestAssessment: {
      id:
        "44444444-4444-4444-8444-444444444444",
      totalScore: 10,
      rulesVersion: "test",
      eligibilityResult: "eligible",
      scoreBreakdown: {},
      blockers: [],
      rationale: "Ready.",
      evidenceIds: records.map(
        (item) => item.id,
      ),
      assessedAt:
        "2026-08-14T13:00:00.000Z",
    },
    companyEnrichment: {
      status: "auto_verified",
      discoveredCompanyNumber:
        "12345678",
      sourceUrl: null,
      candidates: [],
      lastErrorCode: null,
      attemptCount: 1,
      lastAttemptAt:
        "2026-08-14T12:00:00.000Z",
      completedAt:
        "2026-08-14T12:05:00.000Z",
      qualificationState:
        "ready_for_outreach",
      qualificationReasons: [],
      researchSummary: {},
      researchCompletedAt:
        "2026-08-14T12:05:00.000Z",
    },
  };
}

function repository(): OutreachRepository {
  return {
    async getLatestDraft() {
      return null;
    },
    async listActivities() {
      return [];
    },
    async prepareDraft() {
      throw new Error("not used");
    },
    async markDrafted() {
      throw new Error("not used");
    },
    async markDraftFailed() {},
    async recordActivity() {
      throw new Error("not used");
    },
  };
}

const CASES: readonly {
  readonly sector:
    LeadProspectReview["sector"];
  readonly label: string;
  readonly phrase: RegExp;
}[] = [
  {
    sector:
      "short_let_serviced_accommodation",
    label:
      "Short-let and serviced accommodation",
    phrase:
      /regular property changeovers/,
  },
  {
    sector: "offices_coworking",
    label:
      "Offices and coworking spaces",
    phrase:
      /scheduled workplace cleaning/,
  },
  {
    sector:
      "community_halls_event_venues",
    label:
      "Community halls and event venues",
    phrase:
      /cleaning before or after events/,
  },
  {
    sector: "estate_letting_agents",
    label:
      "Estate and letting agents",
    phrase:
      /cleaning between tenancies/,
  },
  {
    sector:
      "university_accommodation",
    label:
      "University accommodation",
    phrase:
      /accommodation turnovers/,
  },
  {
    sector:
      "other_commercial_spaces",
    label:
      "Other commercial spaces",
    phrase:
      /regular cleaning, additional cover/,
  },
];

for (const item of CASES) {
  test(
    `manual preview uses the verified ${item.label} template`,
    async () => {
      const service =
        createManualOutreachService({
          leadReviewService: {
            async getProspect() {
              return prospect(item.sector);
            },
          },
          repository: repository(),
          privacyUrl:
            "https://www.cleanupcentral.com/#/privacy",
          optOutText:
            "If you do not wish to receive further business communications from Clean Up Central, please reply to this email and let us know. We will update our records accordingly.",
        });

      const preview = await service
        .previewDraft(
          FOUNDER_ID,
          PROSPECT_ID,
          null,
        );

      assert.equal(
        preview.sector,
        item.sector,
      );
      assert.equal(
        preview.sectorLabel,
        item.label,
      );
      assert.equal(
        preview.templateId,
        `initial_outreach_v2_${item.sector}`,
      );
      assert.match(
        preview.body,
        item.phrase,
      );
      assert.match(
        preview.body,
        /Privacy Notice: https:\/\/www\.cleanupcentral\.com\/#\/privacy/,
      );
      assert.match(
        preview.previewSha256,
        /^[0-9a-f]{64}$/,
      );
    },
  );
}

test(
  "manual preview refuses a sector that is not verified for the prospect",
  async () => {
    const service =
      createManualOutreachService({
        leadReviewService: {
          async getProspect() {
            return prospect(
              "offices_coworking",
              "other_commercial_spaces",
            );
          },
        },
        repository: repository(),
        privacyUrl:
          "https://www.cleanupcentral.com/#/privacy",
        optOutText:
          "If you do not wish to receive further business communications from Clean Up Central, please reply to this email and let us know. We will update our records accordingly.",
      });

    await assert.rejects(
      service.previewDraft(
        FOUNDER_ID,
        PROSPECT_ID,
        null,
      ),
      (error: unknown) =>
        error instanceof OutreachError &&
        error.failure === "not_eligible",
    );
  },
);
