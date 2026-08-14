import assert from "node:assert/strict";
import test from "node:test";

import {
  createAutomaticQualificationService,
} from "../src/application/qualify-leads.js";

import type {
  AutomaticQualificationRepository,
  AutomaticResearchFact,
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

function assessment(): LeadAssessmentRecord {
  return {
    id:
      "33333333-3333-4333-8333-333333333333",
    totalScore: 8,
    rulesVersion: "test",
    eligibilityResult: "eligible",
    scoreBreakdown: {},
    blockers: [],
    rationale: "test",
    evidenceIds: [],
    assessedAt:
      "2026-08-14T12:00:00.000Z",
  };
}

function prospect(): LeadProspectReview {
  return {
    id: PROSPECT_ID,
    businessName: "Pending verification",
    sector: "university_accommodation",
    primaryPostcode: null,
    websiteUrl: null,
    companyNumber: null,
    createdAt:
      "2026-08-14T10:00:00.000Z",
    hasSearchProvenance: true,
    hasActiveSuppression: false,
    evidence: [],
    contacts: [],
    latestAssessment: null,
  };
}

test(
  "Google-only qualification resolves Place Details transiently before first-party research",
  async () => {
    const recordedFacts:
      AutomaticResearchFact[] = [];
    let completed:
      CompleteAutomaticQualificationInput | undefined;
    let researched:
      | {
          websiteUrl: string;
          businessName: string;
        }
      | undefined;

    const firstPartyFact:
      AutomaticResearchFact = {
        sourceUrl:
          "https://example.ac.uk/accommodation",
        factName: "business_name",
        factValue:
          "Example University Halls",
        sourceExcerpt:
          "Example University Halls",
        contentSha256: "a".repeat(64),
        contactType: null,
        normalizedContactValue: null,
      };

    const research:
      FirstPartyResearchResult = {
        canonicalWebsiteUrl:
          "https://example.ac.uk/accommodation",
        companyNumberAssertions: [],
        facts: [firstPartyFact],
        visitedUrls: [
          "https://example.ac.uk/accommodation",
        ],
        truncatedPageCount: 0,
        organisationType: "university",
        reviewReasons: [],
      };

    const repository:
      AutomaticQualificationRepository = {
        async activate() {
          return 1;
        },
        async claimQualificationJobs() {
          return [{
            prospectId: PROSPECT_ID,
            actorId: FOUNDER_ID,
            businessName:
              "Pending verification",
            sector:
              "university_accommodation",
            websiteUrl: null,
            companyNumber: null,
            googlePlaceId: "place-123",
            attemptCount: 1,
          }];
        },
        async recordResearch(
          _prospectId,
          _actorId,
          _attemptCount,
          facts,
        ) {
          recordedFacts.push(...facts);
          return [];
        },
        async completeQualification(input) {
          completed = input;
        },
        async retry() {},
      };

    const service =
      createAutomaticQualificationService({
        repository,
        googlePlaceDetailsProvider: {
          async resolve(placeId) {
            assert.equal(
              placeId,
              "place-123",
            );
            return {
              placeId,
              businessName:
                "Example University Halls",
              websiteUrl:
                "https://example.ac.uk/accommodation",
            };
          },
        },
        firstPartyProvider: {
          async research(
            websiteUrl,
            businessName,
          ) {
            researched = {
              websiteUrl,
              businessName,
            };
            return research;
          },
        },
        companiesHouseService: {
          async search() {
            throw new Error(
              "institutional research should not require Companies House search",
            );
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
            return assessment();
          },
          async getProspect() {
            return prospect();
          },
        },
        batchSize: 1,
        leaseSeconds: 180,
        activationTotalLimit: 1,
      });

    const batch = await service.runBatch();

    assert.deepEqual(researched, {
      websiteUrl:
        "https://example.ac.uk/accommodation",
      businessName:
        "Example University Halls",
    });
    assert.deepEqual(
      recordedFacts,
      [firstPartyFact],
    );
    assert.equal(
      completed?.queueState,
      "ready_for_outreach",
    );
    assert.equal(
      batch.autoVerifiedCount,
      1,
    );
  },
);
