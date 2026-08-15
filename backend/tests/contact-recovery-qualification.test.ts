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

function identityFact(): AutomaticResearchFact {
  return {
    sourceUrl:
      "https://example.ac.uk/accommodation",
    factName: "business_name",
    factValue: "Example University Halls",
    sourceExcerpt:
      "Example University Halls student accommodation.",
    contentSha256: "a".repeat(64),
    contactType: null,
    normalizedContactValue: null,
  };
}

function research(
  contactFact?: AutomaticResearchFact,
): FirstPartyResearchResult {
  return {
    canonicalWebsiteUrl:
      "https://example.ac.uk/accommodation",
    companyNumberAssertions: [],
    legalOperatorAssertions: [],
    charityNumberAssertions: [],
    facts: [
      identityFact(),
      ...(contactFact === undefined
        ? []
        : [contactFact]),
    ],
    visitedUrls: [
      "https://example.ac.uk/accommodation",
    ],
    truncatedPageCount: 0,
    organisationType: "university",
    reviewReasons:
      contactFact === undefined
        ? ["no_generic_business_contact_found"]
        : [],
  };
}

function repository(
  recorded: AutomaticResearchFact[][],
  completed: {
    value?: CompleteAutomaticQualificationInput;
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
          "https://example.ac.uk/accommodation",
        companyNumber: null,
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
    async completeQualification(input) {
      completed.value = input;
    },
    async retry() {},
  };
}

function leadReviewService() {
  return {
    async assess() {
      return {
        id:
          "33333333-3333-4333-8333-333333333333",
        totalScore: 6,
        rulesVersion: "test",
        eligibilityResult:
          "research_required" as const,
        scoreBreakdown: {},
        blockers: [
          "score_below_ready_threshold",
        ],
        rationale: "test",
        evidenceIds: [],
        assessedAt:
          "2026-08-15T00:00:00.000Z",
      };
    },
    async getProspect() {
      return {
        id: PROSPECT_ID,
        businessName:
          "Example University Halls",
        sector:
          "university_accommodation" as const,
        primaryPostcode: null,
        websiteUrl:
          "https://example.ac.uk/accommodation",
        companyNumber: null,
        createdAt:
          "2026-08-15T00:00:00.000Z",
        hasSearchProvenance: true,
        hasActiveSuppression: false,
        evidence: [],
        contacts: [],
        latestAssessment: null,
      };
    },
  };
}

function companiesHouseService() {
  return {
    async search() {
      return [];
    },
    async verify() {
      throw new Error("not used");
    },
    async verifyAutomatically() {
      throw new Error("not used");
    },
  };
}

test(
  "runs one targeted recovery pass when identity is confirmed but no contact route was found",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    let recoveryCalls = 0;

    const recoveredEmail: AutomaticResearchFact = {
      sourceUrl:
        "https://example.ac.uk/contact",
      factName: "public_email",
      factValue:
        "accommodation@example.ac.uk",
      sourceExcerpt:
        "Accommodation enquiries: accommodation@example.ac.uk",
      contentSha256: "b".repeat(64),
      contactType: "email",
      normalizedContactValue:
        "accommodation@example.ac.uk",
    };

    const service = createAutomaticQualificationService({
      repository:
        repository(recorded, completed),
      firstPartyProvider: {
        async research() {
          return research();
        },
      },
      contactRecoveryProvider: {
        async recover() {
          recoveryCalls += 1;
          return {
            facts: [recoveredEmail],
            visitedUrls: [
              "https://example.ac.uk/contact",
            ],
            truncatedPageCount: 0,
          };
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(recoveryCalls, 1);
    assert.equal(recorded.length, 2);
    assert.deepEqual(
      recorded[1]?.map((fact) =>
        fact.factName),
      ["public_email"],
    );
    assert.equal(
      completed.value?.reasons.includes(
        "no_generic_business_contact_found",
      ),
      false,
    );
    assert.deepEqual(
      completed.value?.researchSummary
        .contactRecovery,
      {
        attempted: true,
        status: "recovered",
        visitedUrls: [
          "https://example.ac.uk/contact",
        ],
        truncatedPageCount: 0,
        recoveredFactCount: 1,
      },
    );
  },
);

test(
  "does not run recovery when ordinary research already found a contact route",
  async () => {
    const recorded: AutomaticResearchFact[][] = [];
    const completed: {
      value?: CompleteAutomaticQualificationInput;
    } = {};
    let recoveryCalls = 0;

    const existingPhone: AutomaticResearchFact = {
      sourceUrl:
        "https://example.ac.uk/accommodation",
      factName: "public_phone",
      factValue: "020 8464 5566",
      sourceExcerpt:
        "Call 020 8464 5566",
      contentSha256: "c".repeat(64),
      contactType: "phone",
      normalizedContactValue:
        "02084645566",
    };

    const service = createAutomaticQualificationService({
      repository:
        repository(recorded, completed),
      firstPartyProvider: {
        async research() {
          return research(existingPhone);
        },
      },
      contactRecoveryProvider: {
        async recover() {
          recoveryCalls += 1;
          return {
            facts: [],
            visitedUrls: [],
            truncatedPageCount: 0,
          };
        },
      },
      companiesHouseService:
        companiesHouseService(),
      leadReviewService:
        leadReviewService(),
      batchSize: 1,
      leaseSeconds: 180,
      activationTotalLimit: 1,
    });

    await service.runBatch();

    assert.equal(recoveryCalls, 0);
    assert.equal(recorded.length, 1);
    assert.deepEqual(
      completed.value?.researchSummary
        .contactRecovery,
      {
        attempted: false,
        status: "not_needed",
        visitedUrls: [],
        truncatedPageCount: 0,
        recoveredFactCount: 0,
      },
    );
  },
);
