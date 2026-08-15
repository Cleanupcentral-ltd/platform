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

const PROSPECT_ID =
  "11111111-1111-4111-8111-111111111111";
const FOUNDER_ID =
  "22222222-2222-4222-8222-222222222222";

test(
  "uses a simplified first-party identity query without persisting the simplified business name",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    let identityQuery = "";

    const repository: AutomaticQualificationRepository = {
      async activate() {
        return 1;
      },
      async claimQualificationJobs() {
        return [{
          prospectId: PROSPECT_ID,
          actorId: FOUNDER_ID,
          businessName: "Community House Halls",
          sector: "community_halls_event_venues",
          websiteUrl: "https://community.example/",
          companyNumber: null,
          googlePlaceId: null,
          attemptCount: 1,
        }];
      },
      async recordResearch(
        _prospectId,
        _actorId,
        _attemptCount,
        facts,
      ) {
        recorded.push([...facts]);
        return facts.map((_, index) =>
          `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
        );
      },
      async completeQualification(
        _input: CompleteAutomaticQualificationInput,
      ) {},
      async retry() {},
    };

    const research: FirstPartyResearchResult = {
      canonicalWebsiteUrl: "https://community.example/",
      companyNumberAssertions: [],
      legalOperatorAssertions: [],
      charityNumberAssertions: [],
      facts: [{
        sourceUrl: "https://community.example/",
        factName: "business_name",
        factValue: "Community House",
        sourceExcerpt: "Community House provides rooms and halls for hire.",
        contentSha256: "a".repeat(64),
        contactType: null,
        normalizedContactValue: null,
      }],
      visitedUrls: ["https://community.example/"],
      truncatedPageCount: 0,
      organisationType: "community_organisation",
      reviewReasons: [],
    };

    const service = createAutomaticQualificationService({
      repository,
      firstPartyProvider: {
        async research(_websiteUrl, businessName) {
          identityQuery = businessName;
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
          return {
            id: "33333333-3333-4333-8333-333333333333",
            totalScore: 0,
            rulesVersion: "test",
            eligibilityResult: "research_required" as const,
            scoreBreakdown: {},
            blockers: ["score_below_ready_threshold"],
            rationale: "test",
            evidenceIds: [],
            assessedAt: "2026-08-15T00:00:00.000Z",
          };
        },
        async getProspect() {
          return {
            id: PROSPECT_ID,
            businessName: "Community House Halls",
            sector: "community_halls_event_venues" as const,
            primaryPostcode: null,
            websiteUrl: "https://community.example/",
            companyNumber: null,
            createdAt: "2026-08-15T00:00:00.000Z",
            hasSearchProvenance: true,
            hasActiveSuppression: false,
            evidence: [],
            contacts: [],
            latestAssessment: null,
          };
        },
      },
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(identityQuery, "Community House");
    assert.equal(
      recorded[0]?.find((fact) =>
        fact.factName === "business_name")?.factValue,
      "Community House Halls",
    );
  },
);
