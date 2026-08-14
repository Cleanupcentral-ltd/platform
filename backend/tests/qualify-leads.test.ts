import assert from "node:assert/strict";
import test from "node:test";

import {
  createAutomaticQualificationService,
} from "../src/application/qualify-leads.js";

import type {
  AutomaticQualificationRepository,
  CompleteAutomaticQualificationInput,
  FirstPartyResearchResult,
} from "../src/ports/automatic-qualification.js";

import type {
  LeadAssessmentRecord,
  LeadProspectReview,
} from "../src/ports/lead-review.js";

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

const research: FirstPartyResearchResult = {
  canonicalWebsiteUrl:
    "https://example.ac.uk/accommodation",
  companyNumberAssertions: [],
  facts: [],
  visitedUrls: [
    "https://example.ac.uk/accommodation",
    "https://example.ac.uk/contact",
  ],
  truncatedPageCount: 0,
  organisationType: "university",
  reviewReasons: [],
};

function assessment(
  eligible: boolean,
  blockers: readonly string[],
): LeadAssessmentRecord {
  return {
    id:
      "33333333-3333-4333-8333-333333333333",
    totalScore: eligible ? 8 : 6,
    rulesVersion: "cuc-lel-0-10-v1.1",
    eligibilityResult:
      eligible ? "eligible" : "research_required",
    scoreBreakdown: {},
    blockers,
    rationale: "test",
    evidenceIds: [],
    assessedAt:
      "2026-08-13T12:00:00.000Z",
  };
}

function prospect(
  suppressed: boolean,
): LeadProspectReview {
  return {
    id: PROSPECT_ID,
    businessName: "Example University Halls",
    sector: "university_accommodation",
    primaryPostcode: "SE10 9ED",
    websiteUrl:
      "https://example.ac.uk/accommodation",
    companyNumber: null,
    createdAt:
      "2026-08-13T10:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: suppressed,
    evidence: [],
    contacts: [],
    latestAssessment: null,
  };
}

function repository(
  capture: {
    complete?:
      CompleteAutomaticQualificationInput;
  },
): AutomaticQualificationRepository {
  return {
    async activate() {
      return 1;
    },
    async claimQualificationJobs() {
      return [{
        prospectId: PROSPECT_ID,
        actorId: FOUNDER_ID,
        businessName:
          "Example University Halls",
        sector:
          "university_accommodation",
        websiteUrl:
          "http://example.ac.uk/accommodation",
        companyNumber: null,
        attemptCount: 1,
      }];
    },
    async recordResearch() {
      return [];
    },
    async completeQualification(input) {
      capture.complete = input;
    },
    async retry() {},
  };
}

test(
  "official institutional evidence can enter the ready queue without a Companies House match",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    let companiesHouseSearches = 0;
    const service =
      createAutomaticQualificationService({
        repository: repository(capture),
        firstPartyProvider: {
          async research() {
            return research;
          },
        },
        companiesHouseService: {
          async search() {
            companiesHouseSearches += 1;
            return [];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(true, []);
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    const batch = await service.runBatch();

    assert.equal(companiesHouseSearches, 0);
    assert.equal(batch.autoVerifiedCount, 1);
    assert.equal(
      capture.complete?.queueState,
      "ready_for_outreach",
    );
    assert.deepEqual(
      capture.complete?.reasons,
      [],
    );
  },
);

test(
  "an active suppression always routes an otherwise qualified prospect to excluded",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    const service =
      createAutomaticQualificationService({
        repository: repository(capture),
        firstPartyProvider: {
          async research() {
            return research;
          },
        },
        companiesHouseService: {
          async search() {
            return [];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(false, [
              "do_not_contact_or_objection",
            ]);
          },
          async getProspect() {
            return prospect(true);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    await service.runBatch();

    assert.equal(
      capture.complete?.queueState,
      "excluded",
    );
    assert.ok(
      capture.complete?.reasons.includes(
        "do_not_contact_or_objection",
      ),
    );
  },
);

test(
  "postcode cross-check records one active premises",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    let premises:
      | {
          sourceUrl: string;
          sourceExcerpt: string;
          contentSha256: string;
        }
      | undefined;

    const qualificationRepository:
      AutomaticQualificationRepository = {
        ...repository(capture),
        async recordSinglePremises(
          _prospectId,
          _actorId,
          _attemptCount,
          sourceUrl,
          sourceExcerpt,
          contentSha256,
        ) {
          premises = {
            sourceUrl,
            sourceExcerpt,
            contentSha256,
          };
          return [
            "44444444-4444-4444-8444-444444444444",
          ];
        },
      };

    const service =
      createAutomaticQualificationService({
        repository: qualificationRepository,
        firstPartyProvider: {
          async research() {
            return {
              ...research,
              facts: [{
                sourceUrl:
                  "https://example.ac.uk/accommodation",
                factName: "business_name",
                factValue:
                  "Example University Halls",
                sourceExcerpt:
                  "Example University Halls, 1 College Road, London SE10 9ED.",
                contentSha256:
                  "a".repeat(64),
                contactType: null,
                normalizedContactValue: null,
              }],
            };
          },
        },
        companiesHouseService: {
          async search() {
            return [];
          },
          async verify() {
            throw new Error("not used");
          },
          async verifyAutomatically() {
            throw new Error("not used");
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(
              false,
              ["score_below_ready_threshold"],
            );
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    await service.runBatch();

    assert.equal(
      premises?.sourceUrl,
      "https://example.ac.uk/accommodation",
    );
    assert.ok(
      premises?.sourceExcerpt.includes(
        "SE10 9ED",
      ),
    );
    assert.match(
      premises?.contentSha256 ?? "",
      /^[0-9a-f]{64}$/,
    );
    assert.equal(
      capture.complete?.researchSummary
        .verifiedFactCount,
      2,
    );
  },
);

test(
  "charity-number evidence uses the Charity Commission path without a Companies House name search",
  async () => {
    const capture: {
      complete?:
        CompleteAutomaticQualificationInput;
    } = {};
    let charityVerifications = 0;
    let companiesHouseSearches = 0;

    const charityResearch:
      FirstPartyResearchResult = {
        ...research,
        canonicalWebsiteUrl:
          "https://example.org/",
        visitedUrls: [
          "https://example.org/",
        ],
        organisationType: "charity",
        charityNumberAssertions: [{
          charityNumber: "1133537",
          sourceUrl:
            "https://example.org/",
          sourceExcerpt:
            "Registered charity - 1133537",
          contentSha256:
            "b".repeat(64),
        }],
      };

    const service =
      createAutomaticQualificationService({
        repository:
          repository(capture),
        firstPartyProvider: {
          async research() {
            return charityResearch;
          },
        },
        charityCommissionService: {
          async verifyAutomatically() {
            charityVerifications += 1;
            return {
              charityName:
                "M.A. CENTRE UK",
              charityNumber:
                "1133537",
              businessStatus:
                "active",
              evidenceIds: [],
            };
          },
        },
        companiesHouseService: {
          async search() {
            companiesHouseSearches += 1;
            return [];
          },
          async verify() {
            throw new Error(
              "not used",
            );
          },
          async verifyAutomatically() {
            throw new Error(
              "not used",
            );
          },
        },
        leadReviewService: {
          async assess() {
            return assessment(
              false,
              [
                "unresolved_subscriber_type",
              ],
            );
          },
          async getProspect() {
            return prospect(false);
          },
        },
        batchSize: 5,
        leaseSeconds: 180,
        activationTotalLimit: null,
      });

    await service.runBatch();

    assert.equal(
      charityVerifications,
      1,
    );
    assert.equal(
      companiesHouseSearches,
      0,
    );
    assert.equal(
      capture.complete
        ?.enrichmentStatus,
      "auto_verified",
    );
    assert.ok(
      Array.isArray(
        capture.complete
          ?.researchSummary
          .charityNumbers,
      ),
    );
  },
);
